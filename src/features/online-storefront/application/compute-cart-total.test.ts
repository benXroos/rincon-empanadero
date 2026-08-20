import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Cart } from "@/features/online-storefront/domain/cart";
import { DiscountValidationError } from "@/features/online-storefront/domain/discount";

const { listPriceListItemsMock, listPackPriceListItemsMock, getDiscountCodeByCodeMock } =
  vi.hoisted(() => ({
    listPriceListItemsMock: vi.fn(),
    listPackPriceListItemsMock: vi.fn(),
    getDiscountCodeByCodeMock: vi.fn(),
  }));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  listPriceListItems: listPriceListItemsMock,
  listPackPriceListItems: listPackPriceListItemsMock,
}));

vi.mock("@/features/online-storefront/infrastructure/storefront.repository", () => ({
  getDiscountCodeByCode: getDiscountCodeByCodeMock,
}));

const { computeCartTotal } =
  await import("@/features/online-storefront/application/compute-cart-total");

/**
 * Resolves each cart line's catalog price (spec "Cart, discounts, shipping,
 * fulfillment, checkout") — a pack line prices via its OWN fixed
 * `pack_price_list_items` entry, NEVER the sum of its chosen flavors'
 * prices (the Phase 3 correction — see `product-catalog.repository.ts`'s
 * `upsertPackPriceListItem` docs). Then applies an optional discount code
 * via the pure `domain/discount.ts#applyDiscountCode`.
 */
describe("computeCartTotal", () => {
  const carneCuchillo = "flavor-carne-cuchillo";
  const packId = "pack-docena";

  beforeEach(() => {
    listPriceListItemsMock.mockReset();
    listPackPriceListItemsMock.mockReset();
    getDiscountCodeByCodeMock.mockReset();
  });

  it("sums a flavor line's quantity × its own-channel price", async () => {
    const cart: Cart = { lines: [{ itemType: "flavor", flavorId: carneCuchillo, quantity: 3 }] };
    listPriceListItemsMock.mockResolvedValueOnce([{ channel: "own", price: "2500.00" }]);

    const result = await computeCartTotal(cart, "own");

    expect(result.subtotal.toString()).toBe("7500");
    expect(result.total.toString()).toBe("7500");
  });

  it("prices a pack line by its OWN fixed pack price, never the sum of flavor prices", async () => {
    const cart: Cart = {
      lines: [{ itemType: "pack", packId, selection: { [carneCuchillo]: 12 } }],
    };
    listPackPriceListItemsMock.mockResolvedValueOnce([{ channel: "own", price: "25000.00" }]);

    const result = await computeCartTotal(cart, "own");

    expect(result.subtotal.toString()).toBe("25000");
  });

  it("applies a valid, active discount code to the subtotal", async () => {
    const cart: Cart = { lines: [{ itemType: "flavor", flavorId: carneCuchillo, quantity: 1 }] };
    listPriceListItemsMock.mockResolvedValueOnce([{ channel: "own", price: "10000.00" }]);
    getDiscountCodeByCodeMock.mockResolvedValueOnce({
      code: "PROMO10",
      type: "percentage",
      value: "10",
      active: true,
    });

    const result = await computeCartTotal(cart, "own", "PROMO10");

    expect(result.subtotal.toString()).toBe("10000");
    expect(result.total.toString()).toBe("9000");
  });

  it("rejects a discount code that does not exist", async () => {
    const cart: Cart = { lines: [{ itemType: "flavor", flavorId: carneCuchillo, quantity: 1 }] };
    listPriceListItemsMock.mockResolvedValueOnce([{ channel: "own", price: "10000.00" }]);
    getDiscountCodeByCodeMock.mockResolvedValueOnce(undefined);

    await expect(computeCartTotal(cart, "own", "DOES-NOT-EXIST")).rejects.toThrow(
      DiscountValidationError,
    );
  });
});
