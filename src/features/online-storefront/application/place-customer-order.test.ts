import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartValidationError } from "@/features/online-storefront/domain/cart";

const {
  addFlavorToCartMock,
  addPackToCartMock,
  computeCheckoutTotalMock,
  insertSalesOrderMock,
  insertSalesOrderLinesMock,
} = vi.hoisted(() => ({
  addFlavorToCartMock: vi.fn(),
  addPackToCartMock: vi.fn(),
  computeCheckoutTotalMock: vi.fn(),
  insertSalesOrderMock: vi.fn(),
  insertSalesOrderLinesMock: vi.fn(),
}));

vi.mock("@/features/online-storefront/application/cart-service", () => ({
  addFlavorToCart: addFlavorToCartMock,
  addPackToCart: addPackToCartMock,
}));

vi.mock("@/features/online-storefront/application/compute-checkout-total", () => ({
  computeCheckoutTotal: computeCheckoutTotalMock,
}));

vi.mock("@/features/sales-orders/infrastructure/sales-order.repository", () => ({
  insertSalesOrder: insertSalesOrderMock,
  insertSalesOrderLines: insertSalesOrderLinesMock,
}));

const { placeCustomerOrder } =
  await import("@/features/online-storefront/application/place-customer-order");

/**
 * The NEW public checkout action (`sdd/.../checkout-auth-decision`) — a
 * SEPARATE action from the staff-gated `registerSale`, with NO
 * `requireRole`/`requireSession` call anywhere in this file (the key
 * assertion threaded through every test below: none of the mocked
 * dependencies ever receive an auth check because there isn't one). Rebuilds
 * a server-validated `Cart` from raw customer input via the EXISTING,
 * already-tested `cart-service.ts` functions (fresh availability/eligibility
 * checks) rather than trusting a client-supplied `Cart` object as-is.
 */
describe("placeCustomerOrder (public, no auth)", () => {
  const priceLine = {
    itemType: "flavor" as const,
    itemId: "flavor-1",
    quantity: 2,
    unitPrice: "2500",
    lineTotal: "5000",
  };

  beforeEach(() => {
    addFlavorToCartMock.mockReset();
    addPackToCartMock.mockReset();
    computeCheckoutTotalMock.mockReset();
    insertSalesOrderMock.mockReset();
    insertSalesOrderLinesMock.mockReset();
  });

  it("rebuilds the cart via addFlavorToCart for a flavor line, then prices and persists it", async () => {
    const builtCart = { lines: [{ itemType: "flavor", flavorId: "flavor-1", quantity: 2 }] };
    addFlavorToCartMock.mockResolvedValueOnce(builtCart);
    computeCheckoutTotalMock.mockResolvedValueOnce({
      lines: [priceLine],
      total: { toString: () => "5000" },
    });
    insertSalesOrderMock.mockResolvedValueOnce({ id: "order-1" });
    insertSalesOrderLinesMock.mockResolvedValueOnce([]);

    const result = await placeCustomerOrder({
      lines: [{ itemType: "flavor", flavorId: "flavor-1", quantity: 2 }],
      fulfillment: "pickup",
      paymentMethod: "cash",
    });

    expect(addFlavorToCartMock).toHaveBeenCalledWith(
      { lines: [] },
      { flavorId: "flavor-1", quantity: 2 },
    );
    expect(computeCheckoutTotalMock).toHaveBeenCalledWith({
      cart: builtCart,
      channel: "own",
      fulfillment: "pickup",
      postalCode: undefined,
      discountCode: undefined,
    });
    expect(insertSalesOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "own",
        paymentMethod: "cash",
        totalAmount: "5000",
        fulfillmentMethod: "pickup",
        postalCode: null,
      }),
    );
    expect(result.order.id).toBe("order-1");
    expect(result.paymentInstructions.method).toBe("cash");
  });

  it("rebuilds the cart via addPackToCart for a pack line", async () => {
    const builtCart = { lines: [{ itemType: "pack", packId: "pack-1", selection: {} }] };
    addPackToCartMock.mockResolvedValueOnce(builtCart);
    computeCheckoutTotalMock.mockResolvedValueOnce({
      lines: [],
      total: { toString: () => "25000" },
    });
    insertSalesOrderMock.mockResolvedValueOnce({ id: "order-2" });
    insertSalesOrderLinesMock.mockResolvedValueOnce([]);

    await placeCustomerOrder({
      lines: [{ itemType: "pack", packId: "pack-1", selection: { "flavor-1": 12 } }],
      fulfillment: "pickup",
      paymentMethod: "transfer",
    });

    expect(addPackToCartMock).toHaveBeenCalledWith(
      { lines: [] },
      { packId: "pack-1", selection: { "flavor-1": 12 } },
    );
  });

  it("passes the postal code through for delivery and stores fulfillmentMethod/postalCode", async () => {
    addFlavorToCartMock.mockResolvedValueOnce({ lines: [] });
    computeCheckoutTotalMock.mockResolvedValueOnce({
      lines: [],
      total: { toString: () => "6500" },
    });
    insertSalesOrderMock.mockResolvedValueOnce({ id: "order-3" });
    insertSalesOrderLinesMock.mockResolvedValueOnce([]);

    await placeCustomerOrder({
      lines: [{ itemType: "flavor", flavorId: "flavor-1", quantity: 1 }],
      fulfillment: "delivery",
      postalCode: "1900",
      paymentMethod: "cash",
    });

    expect(computeCheckoutTotalMock).toHaveBeenCalledWith(
      expect.objectContaining({ fulfillment: "delivery", postalCode: "1900" }),
    );
    expect(insertSalesOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ fulfillmentMethod: "delivery", postalCode: "1900" }),
    );
  });

  it("propagates a CartValidationError from cart-service and never touches the repository", async () => {
    addFlavorToCartMock.mockRejectedValueOnce(new CartValidationError("Flavor is not available."));

    await expect(
      placeCustomerOrder({
        lines: [{ itemType: "flavor", flavorId: "unavailable-flavor", quantity: 1 }],
        fulfillment: "pickup",
        paymentMethod: "cash",
      }),
    ).rejects.toThrow(CartValidationError);

    expect(insertSalesOrderMock).not.toHaveBeenCalled();
  });
});
