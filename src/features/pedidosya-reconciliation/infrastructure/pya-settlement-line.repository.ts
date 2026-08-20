import { and, gte, lte } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { pyaSettlementLines, type NewPyaSettlementLine } from "@/infrastructure/db/schema";

/**
 * Drizzle repository for Stage 2 (settlement reconciliation) of the
 * pedidosya-reconciliation capability. Holds no business logic — variance
 * status/amount are computed by the pure
 * `domain/compute-settlement-variance.ts` before a row ever reaches this
 * file. No mutating function here checks a role — that is
 * `application/import-pya-settlement.ts`'s job.
 */

export async function insertPyaSettlementLine(row: NewPyaSettlementLine) {
  const [inserted] = await getDb().insert(pyaSettlementLines).values(row).returning();
  return inserted;
}

/**
 * Date-range query (Phase 10's metrics dashboard will call this directly,
 * same pattern as the Stage 1 estimates' range query).
 */
export async function listPyaSettlementLinesInRange(start: Date, end: Date) {
  return getDb()
    .select()
    .from(pyaSettlementLines)
    .where(and(gte(pyaSettlementLines.orderDate, start), lte(pyaSettlementLines.orderDate, end)));
}
