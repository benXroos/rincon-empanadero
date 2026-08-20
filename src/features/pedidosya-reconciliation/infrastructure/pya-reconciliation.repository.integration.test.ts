import "@/test/load-test-env";

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { pyaDailyEstimates } from "@/infrastructure/db/schema";
import {
  insertPyaDailyEstimate,
  listPyaDailyEstimatesInRange,
  findPyaDailyEstimateByOrderNumber,
} from "@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository";

/**
 * Real Neon Postgres round-trip test — same
 * `import { config } from "dotenv"; config({ path: ".env.local" });` +
 * `describe.skipIf(!hasDatabase)` pattern established since Phase 3.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)(
  "pya-reconciliation repository, Stage 1 (live Neon integration)",
  () => {
    const createdEstimateIds: string[] = [];

    afterEach(async () => {
      const db = getDb();
      for (const id of createdEstimateIds.splice(0)) {
        await db.delete(pyaDailyEstimates).where(eq(pyaDailyEstimates.id, id));
      }
    });

    it("persists a daily estimate and reads it back unchanged", async () => {
      const inserted = await insertPyaDailyEstimate({
        orderNumber: "PYA-INTEGRATION-1",
        orderDate: new Date("2026-08-16T00:00:00Z"),
        grossAmount: "10000",
        paymentMethod: "paid_in_app",
        comisionTotalUsed: "0.3083",
        cashInTillToday: "0",
        estimatedNetKept: "6917",
      });
      createdEstimateIds.push(inserted.id);

      const found = await findPyaDailyEstimateByOrderNumber("PYA-INTEGRATION-1");

      expect(found?.id).toBe(inserted.id);
      expect(found?.paymentMethod).toBe("paid_in_app");
      expect(found?.estimatedNetKept).toBe("6917.0000");
    });

    it("lists estimates within a date range, excluding out-of-range orders", async () => {
      const inRange = await insertPyaDailyEstimate({
        orderNumber: "PYA-INTEGRATION-2",
        orderDate: new Date("2026-08-16T00:00:00Z"),
        grossAmount: "5000",
        paymentMethod: "cash_collected_by_store",
        comisionTotalUsed: "0.3083",
        cashInTillToday: "5000",
        estimatedNetKept: "3458.5",
      });
      createdEstimateIds.push(inRange.id);

      const outOfRange = await insertPyaDailyEstimate({
        orderNumber: "PYA-INTEGRATION-3",
        orderDate: new Date("2026-09-16T00:00:00Z"),
        grossAmount: "5000",
        paymentMethod: "cash_collected_by_store",
        comisionTotalUsed: "0.3083",
        cashInTillToday: "5000",
        estimatedNetKept: "3458.5",
      });
      createdEstimateIds.push(outOfRange.id);

      const results = await listPyaDailyEstimatesInRange(
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-08-31T00:00:00Z"),
      );

      const orderNumbers = results.map((r) => r.orderNumber);
      expect(orderNumbers).toContain("PYA-INTEGRATION-2");
      expect(orderNumbers).not.toContain("PYA-INTEGRATION-3");
    });

    it("returns undefined when no estimate exists for an order number", async () => {
      const found = await findPyaDailyEstimateByOrderNumber("PYA-DOES-NOT-EXIST");
      expect(found).toBeUndefined();
    });
  },
);
