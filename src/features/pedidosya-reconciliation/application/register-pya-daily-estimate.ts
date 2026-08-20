"use server";

import type Decimal from "decimal.js";
import { requireRole } from "@/core/auth/require-role.server";
import {
  computePyaEstimate,
  PyaProfileNotConfiguredError,
  type PyaPaymentMethod,
} from "@/features/pedidosya-reconciliation/domain/compute-pya-estimate";
import { insertPyaDailyEstimate } from "@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository";
import { calcularComisionTotal } from "@/features/pricing/domain/calculator";
import { resolveActiveProfile } from "@/features/pricing/domain/resolve-active-profile";
import { listPricingProfileVersions } from "@/features/pricing/infrastructure/pricing-profile.repository";

/**
 * `registerPyaDailyEstimate` — Stage 1 of the pedidosya-reconciliation
 * capability (spec "Manual reconciliation entry", refined by
 * sdd/rincon-empanadero-management-app/pedidosya-reconciliation-design).
 * Recorded as EACH PedidosYa order comes in — feeds "caja diaria" accuracy
 * TODAY, before PedidosYa's real settlement file arrives ~2 weeks later.
 *
 * Owner-confirmed write scope (mvp-decisions): both admin and colaborador
 * can register this — day-to-day data entry, matching `registerSale`/
 * `registerPurchase`'s boundary (`requireRole(["admin", "colaborador"])`).
 *
 * The commission percentage is NEVER hardcoded here — it is resolved from
 * the SAME `pedidosya` `pricing_profile` config every other channel-priced
 * figure uses, via `resolveActiveProfile` (Phase 2) +
 * `calcularComisionTotal` (the extracted, reusable half of the pricing
 * calculator).
 */
export interface RegisterPyaDailyEstimateInput {
  orderNumber: string;
  grossAmount: Decimal.Value;
  paymentMethod: PyaPaymentMethod;
  /** Defaults to `new Date()` — an order with no explicit date came in now. */
  orderDate?: Date;
}

export async function registerPyaDailyEstimate(input: RegisterPyaDailyEstimateInput) {
  await requireRole(["admin", "colaborador"]);

  const orderDate = input.orderDate ?? new Date();

  const profiles = await listPricingProfileVersions("pedidosya");
  const activeProfile = resolveActiveProfile(profiles, "pedidosya", orderDate);

  if (!activeProfile) {
    throw new PyaProfileNotConfiguredError(
      "No pedidosya pricing profile is configured yet — cannot estimate commission.",
    );
  }

  const comisionTotal = calcularComisionTotal(activeProfile);

  const { cashInTillToday, estimatedNetKept } = computePyaEstimate({
    grossAmount: input.grossAmount,
    paymentMethod: input.paymentMethod,
    comisionTotal,
  });

  return insertPyaDailyEstimate({
    orderNumber: input.orderNumber,
    orderDate,
    grossAmount: input.grossAmount.toString(),
    paymentMethod: input.paymentMethod,
    comisionTotalUsed: comisionTotal.toString(),
    cashInTillToday: cashInTillToday.toString(),
    estimatedNetKept: estimatedNetKept.toString(),
  });
}
