import "@/test/load-test-env";

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { salesOrders, salesOrderLines } from "@/infrastructure/db/schema";
import {
  insertSalesOrder,
  insertSalesOrderLines,
  listSalesOrderLines,
  listSalesOrdersInRange,
} from "@/features/sales-orders/infrastructure/sales-order.repository";

/**
 * Real Neon Postgres round-trip test — same pattern established by
 * `product-catalog.repository.integration.test.ts`:
 * `import { config } from "dotenv"; config({ path: ".env.local" });` at the
 * top, then `describe.skipIf(!process.env.DATABASE_URL)`.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("sales-order repository (live Neon integration)", () => {
  const createdOrderIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const orderId of createdOrderIds.splice(0)) {
      await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, orderId));
      await db.delete(salesOrders).where(eq(salesOrders.id, orderId));
    }
  });

  it("persists a sales order with its lines and reads the lines back unchanged", async () => {
    const order = await insertSalesOrder({
      channel: "own",
      paymentMethod: "cash",
      totalAmount: "5000.00",
      soldAt: new Date("2026-08-10T12:00:00Z"),
    });
    createdOrderIds.push(order.id);

    await insertSalesOrderLines([
      {
        salesOrderId: order.id,
        itemType: "flavor",
        itemId: "00000000-0000-0000-0000-000000000001",
        quantity: 2,
        unitPriceSnapshot: "2500.00",
        lineTotal: "5000.00",
      },
    ]);

    const lines = await listSalesOrderLines(order.id);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.unitPriceSnapshot).toBe("2500.00");
    expect(lines[0]?.lineTotal).toBe("5000.00");
  });

  it("still returns an order unchanged when queried by date range next week (order persists across dates)", async () => {
    const soldAt = new Date("2026-08-10T12:00:00Z");
    const order = await insertSalesOrder({
      channel: "pedidosya",
      paymentMethod: "transfer",
      totalAmount: "13000.00",
      soldAt,
    });
    createdOrderIds.push(order.id);

    const nextWeek = await listSalesOrdersInRange(
      new Date("2026-08-17T00:00:00Z"),
      new Date("2026-08-24T00:00:00Z"),
    );
    expect(nextWeek.find((o) => o.id === order.id)).toBeUndefined();

    const sameWeek = await listSalesOrdersInRange(
      new Date("2026-08-10T00:00:00Z"),
      new Date("2026-08-11T00:00:00Z"),
    );
    const found = sameWeek.find((o) => o.id === order.id);
    expect(found?.totalAmount).toBe("13000.00");
    expect(found?.channel).toBe("pedidosya");
  });
});
