"use server";

import type Decimal from "decimal.js";
import { requireRole } from "@/core/auth/require-role.server";
import { validateDecomisoQuantity } from "@/features/purchase-expense-log/domain/validate-decomiso-entry";
import { insertDecomisoLog } from "@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository";

/**
 * `registerDecomiso` — the waste/decomiso-by-flavor write half of the
 * purchase-expense-log capability (mvp-decisions #10). Same admin-only
 * permission boundary as `registerPurchase` — see that file's doc comment
 * for the full reasoning; colaborador keeps read access via
 * `listDecomisoLogs`/`listDecomisoLogsInRange`, which carry no role check.
 */
export interface RegisterDecomisoInput {
  flavorId: string;
  quantityWasted: Decimal.Value;
  /** Defaults to `new Date()` — a decomiso entry with no explicit date happened now. */
  wasteDate?: Date;
  reason?: string;
}

export async function registerDecomiso(input: RegisterDecomisoInput) {
  await requireRole(["admin"]);

  const quantityWasted = validateDecomisoQuantity(input.quantityWasted);

  return insertDecomisoLog({
    flavorId: input.flavorId,
    quantityWasted: quantityWasted.toString(),
    wasteDate: input.wasteDate ?? new Date(),
    reason: input.reason,
  });
}
