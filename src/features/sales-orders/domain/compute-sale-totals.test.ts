import { describe, expect, it } from "vitest";
import {
  computeSaleTotals,
  SaleValidationError,
} from "@/features/sales-orders/domain/compute-sale-totals";

/**
 * Pure domain logic for a sales-order (spec capability "sales-orders").
 * A sale is a completed-sale record — no pending/paid/fulfilled state
 * machine (MVP scope decision, see sdd/rincon-empanadero-management-app
 * apply-progress ambiguity resolution). This function computes each line's
 * total and the order's grand total from already-resolved unit prices; it
 * never looks up a live catalog price itself — the caller (a manual
 * sale-entry action, or Phase 6's checkout) resolves the price and passes
 * it in, so registering a sale always SNAPSHOTS a price, matching design
 * decision #7's "repricing must not rewrite history" pattern.
 */
describe("computeSaleTotals", () => {
  it("computes each line's total and the order's grand total for two lines", () => {
    const result = computeSaleTotals([
      { quantity: 2, unitPrice: "2500.00" },
      { quantity: 1, unitPrice: "25000.00" },
    ]);

    expect(result.lines[0]?.lineTotal.toString()).toBe("5000");
    expect(result.lines[1]?.lineTotal.toString()).toBe("25000");
    expect(result.orderTotal.toString()).toBe("30000");
  });

  it("computes a different total for a single line with a different quantity/price", () => {
    const result = computeSaleTotals([{ quantity: 3, unitPrice: "800" }]);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.lineTotal.toString()).toBe("2400");
    expect(result.orderTotal.toString()).toBe("2400");
  });

  it("rejects a sale with zero lines", () => {
    expect(() => computeSaleTotals([])).toThrow(SaleValidationError);
  });

  it("rejects a line with a non-positive quantity", () => {
    expect(() => computeSaleTotals([{ quantity: 0, unitPrice: "100" }])).toThrow(
      SaleValidationError,
    );
  });

  it("rejects a line with a negative unit price", () => {
    expect(() => computeSaleTotals([{ quantity: 1, unitPrice: "-1" }])).toThrow(
      SaleValidationError,
    );
  });
});
