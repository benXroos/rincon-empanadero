"use server";

import type Decimal from "decimal.js";
import { requireRole } from "@/core/auth/require-role.server";
import { computePurchaseTotal } from "@/features/purchase-expense-log/domain/compute-purchase-total";
import { insertPurchaseLog } from "@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository";
import type { PurchaseCategory } from "@/infrastructure/db/schema";

/**
 * `registerPurchase` — the write half of the purchase-expense-log
 * capability (spec "Weekly purchase/expense registration", mvp-decisions
 * #10). Owner-confirmed: both admin and colaborador can register purchases
 * (`requireRole(["admin", "colaborador"])`), matching `registerSale`'s
 * boundary — colaborador does the day-to-day weekly purchasing in practice.
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
  await requireRole(["admin", "colaborador"]);

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
