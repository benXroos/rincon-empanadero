import Decimal from "decimal.js";

/**
 * Pure domain logic for the metrics-dashboard capability's PedidosYa
 * variance view (spec "Sales metrics by channel and date range" — "plus the
 * PedidosYa cash-vs-settlement variance view"). No DB/date/env/framework
 * imports.
 *
 * Rolls up Phase 9's two per-order query results for the SAME date range —
 * `listPyaDailyEstimatesInRange` (Stage 1) and `listPyaSettlementLinesInRange`
 * (Stage 2) — into one summary. Deliberately does NOT recompute variance:
 * each settlement line already carries `varianceStatus`/`varianceAmount`
 * computed once at import time by `compute-settlement-variance.ts`; this
 * module only aggregates those already-decided per-order results (per
 * apply-progress's explicit Phase 10 dependency note).
 *
 * `estimatesWithoutSettlementRow` here is the GLOBAL "never covered by any
 * settlement import" view for the requested range — comparing the two range
 * queries directly, rather than any single `importPyaSettlement` call's own
 * per-batch report (which only ever reflects that one file's own date span).
 */
export type PyaVarianceStatus = "matched" | "mismatch" | "no_estimate_found";

export interface PyaEstimateForAggregation {
  orderNumber: string;
  estimatedNetKept: Decimal.Value;
}

export interface PyaSettlementLineForAggregation {
  orderNumber: string;
  netSaleAmount: Decimal.Value;
  serviceFeeAmount: Decimal.Value;
  varianceStatus: PyaVarianceStatus;
  varianceAmount: Decimal.Value | null;
}

export interface MismatchedOrder {
  orderNumber: string;
  varianceAmount: Decimal;
}

export interface PyaVarianceSummary {
  totalEstimatedNetKept: Decimal;
  totalActualNetKept: Decimal;
  /** `totalActualNetKept - totalEstimatedNetKept`, signed. */
  totalVarianceAmount: Decimal;
  mismatchedOrders: MismatchedOrder[];
  /** Settlement rows with no matching Stage 1 estimate at all. */
  noEstimateFoundOrders: string[];
  /** Stage 1 estimates in range with no settlement row in range (global). */
  estimatesWithoutSettlementRow: string[];
}

export function aggregatePyaVariance(
  estimates: PyaEstimateForAggregation[],
  settlementLines: PyaSettlementLineForAggregation[],
): PyaVarianceSummary {
  const totalEstimatedNetKept = estimates.reduce(
    (sum, estimate) => sum.plus(estimate.estimatedNetKept),
    new Decimal(0),
  );

  let totalActualNetKept = new Decimal(0);
  const mismatchedOrders: MismatchedOrder[] = [];
  const noEstimateFoundOrders: string[] = [];

  for (const line of settlementLines) {
    totalActualNetKept = totalActualNetKept.plus(line.netSaleAmount).minus(line.serviceFeeAmount);

    if (line.varianceStatus === "mismatch") {
      mismatchedOrders.push({
        orderNumber: line.orderNumber,
        varianceAmount: new Decimal(line.varianceAmount ?? 0),
      });
    } else if (line.varianceStatus === "no_estimate_found") {
      noEstimateFoundOrders.push(line.orderNumber);
    }
  }

  const settledOrderNumbers = new Set(settlementLines.map((line) => line.orderNumber));
  const estimatesWithoutSettlementRow = estimates
    .filter((estimate) => !settledOrderNumbers.has(estimate.orderNumber))
    .map((estimate) => estimate.orderNumber);

  return {
    totalEstimatedNetKept,
    totalActualNetKept,
    totalVarianceAmount: totalActualNetKept.minus(totalEstimatedNetKept),
    mismatchedOrders,
    noEstimateFoundOrders,
    estimatesWithoutSettlementRow,
  };
}
