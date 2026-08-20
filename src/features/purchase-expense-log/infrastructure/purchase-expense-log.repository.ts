import { and, gte, lte } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import {
  purchaseLogs,
  decomisoLogs,
  type NewPurchaseLog,
  type NewDecomisoLog,
} from "@/infrastructure/db/schema";

/**
 * Drizzle repository for the purchase-expense-log capability. Holds no
 * business logic of its own — totals/validation are computed by the pure
 * `domain/compute-purchase-total.ts`/`domain/validate-decomiso-entry.ts`
 * functions before a row ever reaches this file (mirrors
 * `sales-order.repository.ts`'s split between pure domain and I/O wiring).
 * No mutating function here checks a role — that is the calling
 * application-layer action's job (`register-purchase.ts`/
 * `register-decomiso.ts`), same as `product-catalog.repository.ts`.
 */

export async function insertPurchaseLog(row: NewPurchaseLog) {
  const [inserted] = await getDb().insert(purchaseLogs).values(row).returning();
  return inserted;
}

export async function listPurchaseLogs() {
  return getDb().select().from(purchaseLogs);
}

/**
 * Basic date-range query (Phase 10's metrics dashboard will call this to
 * report expenses over a range — no UI is built for it in this batch).
 */
export async function listPurchaseLogsInRange(start: Date, end: Date) {
  return getDb()
    .select()
    .from(purchaseLogs)
    .where(and(gte(purchaseLogs.purchaseDate, start), lte(purchaseLogs.purchaseDate, end)));
}

export async function insertDecomisoLog(row: NewDecomisoLog) {
  const [inserted] = await getDb().insert(decomisoLogs).values(row).returning();
  return inserted;
}

export async function listDecomisoLogs() {
  return getDb().select().from(decomisoLogs);
}

export async function listDecomisoLogsInRange(start: Date, end: Date) {
  return getDb()
    .select()
    .from(decomisoLogs)
    .where(and(gte(decomisoLogs.wasteDate, start), lte(decomisoLogs.wasteDate, end)));
}
