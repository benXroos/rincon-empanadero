import { describe, expect, it } from "vitest";
import { aggregatePyaVariance } from "./aggregate-pya-variance";

describe("aggregatePyaVariance", () => {
  it("sums estimated vs. actual net kept across a matched-only range", () => {
    const resultado = aggregatePyaVariance(
      [{ orderNumber: "PYA-1", estimatedNetKept: "6917" }],
      [
        {
          orderNumber: "PYA-1",
          netSaleAmount: "10000",
          serviceFeeAmount: "3083",
          varianceStatus: "matched",
          varianceAmount: "0",
        },
      ],
    );

    expect(resultado.totalEstimatedNetKept.toString()).toBe("6917");
    expect(resultado.totalActualNetKept.toString()).toBe("6917");
    expect(resultado.totalVarianceAmount.toString()).toBe("0");
    expect(resultado.mismatchedOrders).toEqual([]);
  });

  it("lists every mismatched order with its variance amount (triangulation: real mismatch)", () => {
    const resultado = aggregatePyaVariance(
      [{ orderNumber: "PYA-2", estimatedNetKept: "31126.5" }],
      [
        {
          orderNumber: "PYA-2",
          netSaleAmount: "45000",
          serviceFeeAmount: "10350",
          varianceStatus: "mismatch",
          varianceAmount: "3523.5",
        },
      ],
    );

    expect(resultado.mismatchedOrders).toHaveLength(1);
    expect(resultado.mismatchedOrders[0].orderNumber).toBe("PYA-2");
    expect(resultado.mismatchedOrders[0].varianceAmount.toString()).toBe("3523.5");
    expect(resultado.totalActualNetKept.toString()).toBe("34650");
    expect(resultado.totalEstimatedNetKept.toString()).toBe("31126.5");
    expect(resultado.totalVarianceAmount.toString()).toBe("3523.5");
  });

  it("flags a settlement line with no matching estimate as no_estimate_found, separate from mismatches", () => {
    const resultado = aggregatePyaVariance(
      [],
      [
        {
          orderNumber: "PYA-3",
          netSaleAmount: "5000",
          serviceFeeAmount: "1150",
          varianceStatus: "no_estimate_found",
          varianceAmount: null,
        },
      ],
    );

    expect(resultado.noEstimateFoundOrders).toEqual(["PYA-3"]);
    expect(resultado.mismatchedOrders).toEqual([]);
    // Still counted toward the real total, per import-pya-settlement's own
    // "surface it regardless of coverage" behavior.
    expect(resultado.totalActualNetKept.toString()).toBe("3850");
  });

  it("flags an estimate with no settlement row in this range as never-covered (global, not per-import-batch)", () => {
    const resultado = aggregatePyaVariance(
      [
        { orderNumber: "PYA-4", estimatedNetKept: "1000" },
        { orderNumber: "PYA-5", estimatedNetKept: "2000" },
      ],
      [
        {
          orderNumber: "PYA-4",
          netSaleAmount: "1450",
          serviceFeeAmount: "450",
          varianceStatus: "matched",
          varianceAmount: "0",
        },
      ],
    );

    expect(resultado.estimatesWithoutSettlementRow).toEqual(["PYA-5"]);
  });

  it("returns all-zero totals and empty lists for an empty range", () => {
    const resultado = aggregatePyaVariance([], []);

    expect(resultado.totalEstimatedNetKept.toString()).toBe("0");
    expect(resultado.totalActualNetKept.toString()).toBe("0");
    expect(resultado.totalVarianceAmount.toString()).toBe("0");
    expect(resultado.mismatchedOrders).toEqual([]);
    expect(resultado.noEstimateFoundOrders).toEqual([]);
    expect(resultado.estimatesWithoutSettlementRow).toEqual([]);
  });
});
