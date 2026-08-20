import Decimal from "decimal.js";

/**
 * Pure domain logic for Stage 1 (the daily estimate, "caja diaria") of the
 * pedidosya-reconciliation capability — no DB/date/env/framework imports.
 * See sdd/rincon-empanadero-management-app/pedidosya-reconciliation-design.
 *
 * Two DISTINCT figures are computed and must never be conflated:
 *
 * - `cashInTillToday`: what physically enters the till TODAY. Full gross
 *   amount when the store itself collected the cash (`Cobrado por: Tu
 *   Local` in PedidosYa's own settlement file); ZERO when the order was
 *   paid in-app (PedidosYa holds it as a receivable, settled ~2 weeks
 *   later).
 * - `estimatedNetKept`: what the store estimates it will ULTIMATELY keep
 *   from this order after PedidosYa's commission, regardless of who
 *   collected the money — `montoBruto * (1 - comisionTotal)`. A
 *   cash-collected order still owes PedidosYa its commission later (it
 *   reduces a future settlement or is invoiced separately), so this figure
 *   is identical in shape for both payment methods.
 *
 * `comisionTotal` is NOT recomputed here — the caller resolves it from the
 * SAME pricing-engine config every other channel-priced figure uses
 * (`calcularComisionTotal` in `@/features/pricing/domain/calculator`,
 * fed by the active `pedidosya` `pricing_profile`), so this module never
 * hardcodes the ~30.83% figure as a second, driftable constant.
 */
export type PyaPaymentMethod = "paid_in_app" | "cash_collected_by_store";

export interface PyaEstimateInput {
  grossAmount: Decimal.Value;
  paymentMethod: PyaPaymentMethod;
  comisionTotal: Decimal.Value;
}

export interface PyaEstimateResult {
  cashInTillToday: Decimal;
  estimatedNetKept: Decimal;
}

export class PyaEstimateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PyaEstimateValidationError";
  }
}

/**
 * Thrown by `application/register-pya-daily-estimate.ts` when no
 * `pedidosya` `pricing_profile` version is active yet — lives here (a
 * plain domain module, no `"use server"` directive) rather than in the
 * server action file itself, since a `"use server"` file may only export
 * async functions, never a class.
 */
export class PyaProfileNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PyaProfileNotConfiguredError";
  }
}

export function computePyaEstimate(input: PyaEstimateInput): PyaEstimateResult {
  const grossAmount = new Decimal(input.grossAmount);

  if (grossAmount.isNegative() || grossAmount.isZero()) {
    throw new PyaEstimateValidationError("PedidosYa order gross amount must be greater than zero.");
  }

  const comisionTotal = new Decimal(input.comisionTotal);
  const estimatedNetKept = grossAmount.times(new Decimal(1).minus(comisionTotal));
  const cashInTillToday =
    input.paymentMethod === "cash_collected_by_store" ? grossAmount : new Decimal(0);

  return { cashInTillToday, estimatedNetKept };
}
