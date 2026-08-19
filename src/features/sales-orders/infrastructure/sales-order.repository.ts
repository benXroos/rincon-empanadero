import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import {
  salesOrders,
  salesOrderLines,
  type NewSalesOrder,
  type NewSalesOrderLine,
} from "@/infrastructure/db/schema";

/**
 * Drizzle repository for the sales-orders capability. Holds no business
 * logic of its own — totals are computed by the pure
 * `domain/compute-sale-totals.ts` before a row ever reaches this file
 * (mirrors `product-catalog.repository.ts`'s split between pure domain and
 * I/O wiring).
 */

export async function insertSalesOrder(row: NewSalesOrder) {
  const [inserted] = await getDb().insert(salesOrders).values(row).returning();
  return inserted;
}

/**
 * Bulk-inserts the lines for an already-created sales order. Returns `[]`
 * without touching the DB for an empty array (`registerSale` never calls
 * this with zero lines — `computeSaleTotals` rejects that before any
 * repository call — but this keeps the function safe to call directly too).
 */
export async function insertSalesOrderLines(rows: NewSalesOrderLine[]) {
  if (rows.length === 0) {
    return [];
  }

  return getDb().insert(salesOrderLines).values(rows).returning();
}

export async function listSalesOrderLines(salesOrderId: string) {
  return getDb()
    .select()
    .from(salesOrderLines)
    .where(eq(salesOrderLines.salesOrderId, salesOrderId));
}

/**
 * Basic date-range query (spec scenario "Order persists across dates" +
 * Phase 10's dashboard needs "sales in a date range"). `channel` is a
 * column on `sales_orders`, so a caller can filter the returned rows by
 * channel itself — no separate per-channel query is needed for this batch.
 */
export async function listSalesOrdersInRange(start: Date, end: Date) {
  return getDb()
    .select()
    .from(salesOrders)
    .where(and(gte(salesOrders.soldAt, start), lte(salesOrders.soldAt, end)));
}
