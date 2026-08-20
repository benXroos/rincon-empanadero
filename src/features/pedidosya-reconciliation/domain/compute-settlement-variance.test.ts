import { describe, expect, it } from "vitest";
import { computeSettlementVariance } from "./compute-settlement-variance";

describe("computeSettlementVariance", () => {
  it("flags 'no_estimate_found' when the settlement row has no matching Stage 1 estimate", () => {
    const resultado = computeSettlementVariance({
      estimatedNetKept: undefined,
      actualNetSaleAmount: "45000",
      actualServiceFeeAmount: "10350",
    });

    expect(resultado.status).toBe("no_estimate_found");
    expect(resultado.varianceAmount).toBeNull();
    expect(resultado.variancePct).toBeNull();
    // PedidosYa's actual net kept is still reported even without a match —
    // the owner wants to see this figure regardless of Stage 1 coverage.
    expect(resultado.actualNetKept.toString()).toBe("34650");
  });

  it("flags 'matched' when the estimate and the real settlement agree within the default tolerance", () => {
    const resultado = computeSettlementVariance({
      estimatedNetKept: "34650",
      actualNetSaleAmount: "45000",
      actualServiceFeeAmount: "10350",
    });

    expect(resultado.status).toBe("matched");
    expect(resultado.varianceAmount?.toString()).toBe("0");
    expect(resultado.variancePct?.toString()).toBe("0");
  });

  it("flags 'mismatch' when the real settlement differs from the estimate beyond tolerance", () => {
    // Our estimate deliberately bakes in IVA + card-fee buffers on top of
    // PedidosYa's stated commission — a real mismatch here is expected and
    // exactly what the owner wants surfaced per order (design memory).
    const resultado = computeSettlementVariance({
      estimatedNetKept: "31126.5", // 45000 * (1 - 0.3083), the Stage 1 estimate formula
      actualNetSaleAmount: "45000",
      actualServiceFeeAmount: "10350", // PedidosYa's real 23%-only commission
    });

    expect(resultado.status).toBe("mismatch");
    expect(resultado.varianceAmount?.toString()).toBe("3523.5");
    expect(resultado.actualNetKept.toString()).toBe("34650");
  });

  it("respects a custom mismatch tolerance ratio", () => {
    const looseTolerance = computeSettlementVariance({
      estimatedNetKept: "31126.5",
      actualNetSaleAmount: "45000",
      actualServiceFeeAmount: "10350",
      mismatchToleranceRatio: "0.2",
    });

    expect(looseTolerance.status).toBe("matched");
  });

  it("reports a negative variance when the real net kept is LOWER than estimated (triangulation)", () => {
    const resultado = computeSettlementVariance({
      estimatedNetKept: "10000",
      actualNetSaleAmount: "9000",
      actualServiceFeeAmount: "0",
    });

    expect(resultado.varianceAmount?.toString()).toBe("-1000");
    expect(resultado.status).toBe("mismatch");
  });
});
