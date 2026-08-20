import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Cart } from "@/features/online-storefront/domain/cart";
import { ShippingValidationError } from "@/features/online-storefront/domain/shipping";

const { computeCartTotalMock, listShippingRatesMock } = vi.hoisted(() => ({
  computeCartTotalMock: vi.fn(),
  listShippingRatesMock: vi.fn(),
}));

vi.mock("@/features/online-storefront/application/compute-cart-total", () => ({
  computeCartTotal: computeCartTotalMock,
}));

vi.mock("@/features/online-storefront/infrastructure/storefront.repository", () => ({
  listShippingRates: listShippingRatesMock,
}));

const { computeCheckoutTotal } =
  await import("@/features/online-storefront/application/compute-checkout-total");

/**
 * Adds shipping on top of the already-resolved cart pricing (reuses
 * `computeCartTotal`, never re-resolves catalog prices itself — per the
 * orchestrator's explicit instruction for this batch). Pickup adds no
 * shipping cost; delivery resolves it via
 * `domain/shipping.ts#resolveShippingCost` against the admin-configured
 * postal-code-prefix rates.
 */
describe("computeCheckoutTotal", () => {
  const cart: Cart = { lines: [{ itemType: "flavor", flavorId: "flavor-1", quantity: 2 }] };

  beforeEach(() => {
    computeCartTotalMock.mockReset();
    listShippingRatesMock.mockReset();
  });

  it("adds no shipping cost for pickup, regardless of configured rates", async () => {
    computeCartTotalMock.mockResolvedValueOnce({
      lines: [],
      subtotal: { toString: () => "5000" },
      total: { plus: () => ({ toString: () => "5000" }) },
    });
    listShippingRatesMock.mockResolvedValueOnce([{ postalCodePrefix: "1900", rate: "1500.00" }]);

    const result = await computeCheckoutTotal({ cart, channel: "own", fulfillment: "pickup" });

    expect(result.shippingCost.toString()).toBe("0");
    expect(result.total.toString()).toBe("5000");
  });

  it("adds the resolved shipping cost for delivery to a matching postal code", async () => {
    computeCartTotalMock.mockResolvedValueOnce({
      lines: [],
      subtotal: { toString: () => "5000" },
      total: { plus: (n: { toString: () => string }) => ({ toString: () => `5000+${n}` }) },
    });
    listShippingRatesMock.mockResolvedValueOnce([{ postalCodePrefix: "1900", rate: "1500.00" }]);

    const result = await computeCheckoutTotal({
      cart,
      channel: "own",
      fulfillment: "delivery",
      postalCode: "1900",
    });

    expect(result.shippingCost.toString()).toBe("1500");
  });

  it("propagates a shipping validation error for an unconfigured delivery zone", async () => {
    computeCartTotalMock.mockResolvedValueOnce({
      lines: [],
      subtotal: { toString: () => "5000" },
      total: { plus: () => ({ toString: () => "5000" }) },
    });
    listShippingRatesMock.mockResolvedValueOnce([]);

    await expect(
      computeCheckoutTotal({ cart, channel: "own", fulfillment: "delivery", postalCode: "9999" }),
    ).rejects.toThrow(ShippingValidationError);
  });
});
