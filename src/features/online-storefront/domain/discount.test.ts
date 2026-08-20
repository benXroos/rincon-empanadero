import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { applyDiscountCode, DiscountValidationError } from "@/features/online-storefront/domain/discount";

/**
 * Spec capability "online-storefront", requirement "Cart, discounts,
 * shipping, fulfillment, checkout" — discount-code calculator. Two discount
 * types, admin-configurable per the MVP gap note (percentage or fixed
 * amount off the cart subtotal); an inactive or undefined code never
 * changes the subtotal or is rejected outright depending on the case.
 */
describe("applyDiscountCode", () => {
  it("returns the subtotal unchanged when no discount code is given", () => {
    const result = applyDiscountCode(new Decimal("10000"), undefined);

    expect(result.toString()).toBe("10000");
  });

  it("applies a percentage discount off the subtotal", () => {
    const result = applyDiscountCode(new Decimal("10000"), {
      code: "PROMO10",
      type: "percentage",
      value: "10",
      active: true,
    });

    expect(result.toString()).toBe("9000");
  });

  it("applies a fixed-amount discount off the subtotal", () => {
    const result = applyDiscountCode(new Decimal("10000"), {
      code: "MENOS2000",
      type: "fixed_amount",
      value: "2000",
      active: true,
    });

    expect(result.toString()).toBe("8000");
  });

  it("never discounts below zero for a fixed-amount code larger than the subtotal", () => {
    const result = applyDiscountCode(new Decimal("1000"), {
      code: "MENOS2000",
      type: "fixed_amount",
      value: "2000",
      active: true,
    });

    expect(result.toString()).toBe("0");
  });

  it("rejects an inactive discount code", () => {
    expect(() =>
      applyDiscountCode(new Decimal("10000"), {
        code: "VENCIDO",
        type: "percentage",
        value: "10",
        active: false,
      }),
    ).toThrow(DiscountValidationError);
  });
});
