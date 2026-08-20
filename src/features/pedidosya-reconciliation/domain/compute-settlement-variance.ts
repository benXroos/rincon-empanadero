import Decimal from "decimal.js";

/**
 * Pure domain logic for Stage 2 (settlement reconciliation) of the
 * pedidosya-reconciliation capability — no DB/date/env/framework imports.
 * See sdd/rincon-empanadero-management-app/pedidosya-reconciliation-design.
 *
 * Compares Stage 1's `estimatedNetKept` (computed same-day, from OUR
 * commission config) against what PedidosYa's REAL settlement file
 * reports for the same order: `actualNetSaleAmount` ("Monto de Venta Neta
 * ($)") minus `actualServiceFeeAmount` ("Servicio Ventas PedidoYa ($)").
 *
 * A nonzero variance is EXPECTED and not itself a bug: Stage 1's estimate
 * deliberately folds in the IVA + card-fee buffers from the confirmed
 * ~30.83% pricing formula, while PedidosYa's settlement file only ever
 * shows its own stated commission percentage. `mismatchToleranceRatio`
 * (default 5% of the estimate) is a documented, tunable heuristic for how
 * large a difference the owner wants flagged for review — not a claim
 * that any nonzero difference is an error. This is the ONE open business
 * assumption in this batch; the owner has not yet specified an exact
 * threshold.
 */
export type SettlementVarianceStatus = "matched" | "mismatch" | "no_estimate_found";

export interface SettlementVarianceInput {
  /** Stage 1's estimate for this order, or `undefined` if none was found. */
  estimatedNetKept: Decimal.Value | undefined;
  actualNetSaleAmount: Decimal.Value;
  actualServiceFeeAmount: Decimal.Value;
  /** Default 5% of the estimate. */
  mismatchToleranceRatio?: Decimal.Value;
}

export interface SettlementVarianceResult {
  status: SettlementVarianceStatus;
  /** What PedidosYa's real file says the store ultimately kept. */
  actualNetKept: Decimal;
  /** `actualNetKept - estimatedNetKept`, signed. `null` when no estimate exists. */
  varianceAmount: Decimal | null;
  /** `varianceAmount / estimatedNetKept`, signed. `null` when no estimate exists. */
  variancePct: Decimal | null;
}

const DEFAULT_MISMATCH_TOLERANCE_RATIO = "0.05";

export function computeSettlementVariance(
  input: SettlementVarianceInput,
): SettlementVarianceResult {
  const actualNetKept = new Decimal(input.actualNetSaleAmount).minus(
    new Decimal(input.actualServiceFeeAmount),
  );

  if (input.estimatedNetKept === undefined) {
    return { status: "no_estimate_found", actualNetKept, varianceAmount: null, variancePct: null };
  }

  const estimatedNetKept = new Decimal(input.estimatedNetKept);
  const varianceAmount = actualNetKept.minus(estimatedNetKept);
  const variancePct = estimatedNetKept.isZero()
    ? new Decimal(0)
    : varianceAmount.div(estimatedNetKept);

  const toleranceRatio = new Decimal(
    input.mismatchToleranceRatio ?? DEFAULT_MISMATCH_TOLERANCE_RATIO,
  );
  const status: SettlementVarianceStatus = variancePct.abs().lte(toleranceRatio)
    ? "matched"
    : "mismatch";

  return { status, actualNetKept, varianceAmount, variancePct };
}
