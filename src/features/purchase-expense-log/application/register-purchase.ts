"use server";

import type Decimal from "decimal.js";
import { requireRole } from "@/core/auth/require-role.server";
import { computePurchaseTotal } from "@/features/purchase-expense-log/domain/compute-purchase-total";
import { insertPurchaseLog } from "@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository";
import type { PurchaseCategory } from "@/infrastructure/db/schema";

/**
 * `registerPurchase` — the write half of the purchase-expense-log
 * capability (spec "Weekly purchase/expense registration", mvp-decisions
 * #10). ADMIN-ONLY: the spec's access-control permission table lists
 * "Register sales"/"Mark attendance"/"View availability/inventory" as
 * explicit colaborador-allowed actions, but says nothing about colaborador
 * WRITING purchase/decomiso records — per the reviewed permission boundary,
 * this defaults to admin-only (`requireRole(["admin"])`, mirroring
 * `createProduct`/`toggleAvailability`) rather than assuming colaborador
 * write access that no spec scenario confirms. Colaborador retains READ
 * access via `listPurchaseLogs`/`listPurchaseLogsInRange`, which carry no
 * role check of their own (same pattern as `listProducts`) and are reachable
 * through the shared `/admin` layout's any-authenticated-session gate.
 *
 * This is a REGISTRATION LOG ONLY — `computePurchaseTotal` only multiplies
 * quantity × unit price; there is no stock-quantity tracking or auto-
 * deduction anywhere in this call path (spec non-goal).
 */
export interface RegisterPurchaseInput {
  itemName: string;
  category: PurchaseCategory;
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  /** Defaults to `new Date()` — a purchase with no explicit date happened now. */
  purchaseDate?: Date;
}

export async function registerPurchase(input: RegisterPurchaseInput) {
  await requireRole(["admin"]);

  const { quantity, unitPrice, totalCost } = computePurchaseTotal(input);

  return insertPurchaseLog({
    itemName: input.itemName,
    category: input.category,
    quantity: quantity.toString(),
    unitPrice: unitPrice.toString(),
    totalCost: totalCost.toString(),
    purchaseDate: input.purchaseDate ?? new Date(),
  });
}
