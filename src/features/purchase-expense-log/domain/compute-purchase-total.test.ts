import { describe, expect, it } from "vitest";
import {
  computePurchaseTotal,
  PurchaseValidationError,
} from "@/features/purchase-expense-log/domain/compute-purchase-total";

/**
 * Pure domain logic (spec "purchase-expense-log" / "Log a purchase"): a
 * purchase line's total cost is quantity × unit price, no stock-quantity
 * side effects — this is a registration log only.
 */
describe("computePurchaseTotal", () => {
  it("multiplies quantity by unit price for a packaging item purchase", () => {
    const result = computePurchaseTotal({ quantity: "10", unitPrice: "150.50" });

    expect(result.totalCost.toString()).toBe("1505");
    expect(result.quantity.toString()).toBe("10");
    expect(result.unitPrice.toString()).toBe("150.5");
  });

  it("computes a different total for a produce item with different quantity/price (triangulation)", () => {
    const result = computePurchaseTotal({ quantity: "3.5", unitPrice: "2000" });

    expect(result.totalCost.toString()).toBe("7000");
  });

  it("rejects a zero quantity", () => {
    expect(() => computePurchaseTotal({ quantity: "0", unitPrice: "100" })).toThrow(
      PurchaseValidationError,
    );
  });

  it("rejects a negative quantity", () => {
    expect(() => computePurchaseTotal({ quantity: "-1", unitPrice: "100" })).toThrow(
      PurchaseValidationError,
    );
  });

  it("rejects a negative unit price", () => {
    expect(() => computePurchaseTotal({ quantity: "1", unitPrice: "-5" })).toThrow(
      PurchaseValidationError,
    );
  });
});
