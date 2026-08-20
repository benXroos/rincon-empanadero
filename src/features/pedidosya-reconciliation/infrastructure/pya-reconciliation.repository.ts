import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { pyaDailyEstimates, type NewPyaDailyEstimate } from "@/infrastructure/db/schema";

/**
 * Drizzle repository for Stage 1 (daily estimate) of the
 * pedidosya-reconciliation capability. Holds no business logic of its own
 * — the estimate figures are computed by the pure
 * `domain/compute-pya-estimate.ts` before a row ever reaches this file
 * (mirrors `purchase-expense-log.repository.ts`'s split). No mutating
 * function here checks a role — that is the calling application-layer
 * action's job (`register-pya-daily-estimate.ts`).
 */

export async function insertPyaDailyEstimate(row: NewPyaDailyEstimate) {
  const [inserted] = await getDb().insert(pyaDailyEstimates).values(row).returning();
  return inserted;
}

export async function listPyaDailyEstimates() {
  return getDb().select().from(pyaDailyEstimates);
}

/**
 * Basic date-range query (Phase 10's metrics dashboard will call this
 * directly, same pattern as every other `*_logs`/`*_estimates` table's
 * range query — no UI is built for it in this batch).
 */
export async function listPyaDailyEstimatesInRange(start: Date, end: Date) {
  return getDb()
    .select()
    .from(pyaDailyEstimates)
    .where(and(gte(pyaDailyEstimates.orderDate, start), lte(pyaDailyEstimates.orderDate, end)));
}

/**
 * Stage 2's reconciliation import matches each real settlement row back to
 * its Stage 1 estimate by `orderNumber` (unique) — this is that lookup.
 */
export async function findPyaDailyEstimateByOrderNumber(orderNumber: string) {
  const [found] = await getDb()
    .select()
    .from(pyaDailyEstimates)
    .where(eq(pyaDailyEstimates.orderNumber, orderNumber));
  return found;
}
