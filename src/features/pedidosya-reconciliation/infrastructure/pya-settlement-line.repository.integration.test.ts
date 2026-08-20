import { config } from "dotenv";
config({ path: ".env.local" });

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { pyaDailyEstimates, pyaSettlementLines } from "@/infrastructure/db/schema";
import { insertPyaDailyEstimate } from "@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository";
import {
  insertPyaSettlementLine,
  listPyaSettlementLinesInRange,
} from "@/features/pedidosya-reconciliation/infrastructure/pya-settlement-line.repository";

/**
 * Real Neon Postgres round-trip test — same
 * `import { config } from "dotenv"; config({ path: ".env.local" });` +
 * `describe.skipIf(!hasDatabase)` pattern established since Phase 3.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)(
  "pya-settlement-line repository, Stage 2 (live Neon integration)",
  () => {
    const createdSettlementLineIds: string[] = [];
    const createdEstimateIds: string[] = [];

    afterEach(async () => {
      const db = getDb();
      for (const id of createdSettlementLineIds.splice(0)) {
        await db.delete(pyaSettlementLines).where(eq(pyaSettlementLines.id, id));
      }
      for (const id of createdEstimateIds.splice(0)) {
        await db.delete(pyaDailyEstimates).where(eq(pyaDailyEstimates.id, id));
      }
    });

    it("persists a settlement line matched to a real estimate and reads it back unchanged", async () => {
      const estimate = await insertPyaDailyEstimate({
        orderNumber: "PYA-SETTLE-1",
        orderDate: new Date("2026-08-16T00:00:00Z"),
        grossAmount: "45000",
        paymentMethod: "cash_collected_by_store",
        comisionTotalUsed: "0.3083",
        cashInTillToday: "45000",
        estimatedNetKept: "31126.5",
      });
      createdEstimateIds.push(estimate.id);

      const inserted = await insertPyaSettlementLine({
        orderNumber: "PYA-SETTLE-1",
        orderDate: new Date("2026-08-16T00:00:00Z"),
        grossAmount: "45000",
        netSaleAmount: "45000",
        serviceFeeAmount: "10350",
        matchedEstimateId: estimate.id,
        varianceStatus: "mismatch",
        varianceAmount: "3523.5",
      });
      createdSettlementLineIds.push(inserted.id);

      const results = await listPyaSettlementLinesInRange(
        new Date("2026-08-01T00:00:00Z"),
        new Date("2026-08-31T00:00:00Z"),
      );
      const found = results.find((r) => r.id === inserted.id);

      expect(found?.orderNumber).toBe("PYA-SETTLE-1");
      expect(found?.matchedEstimateId).toBe(estimate.id);
      expect(found?.varianceStatus).toBe("mismatch");
      expect(found?.varianceAmount).toBe("3523.5000");
    });

    it("persists a settlement line with NO matched estimate (no_estimate_found)", async () => {
      const inserted = await insertPyaSettlementLine({
        orderNumber: "PYA-SETTLE-ORPHAN",
        orderDate: new Date("2026-08-16T00:00:00Z"),
        grossAmount: "1000",
        netSaleAmount: "1000",
        serviceFeeAmount: "230",
        matchedEstimateId: null,
        varianceStatus: "no_estimate_found",
        varianceAmount: null,
      });
      createdSettlementLineIds.push(inserted.id);

      expect(inserted.matchedEstimateId).toBeNull();
      expect(inserted.varianceStatus).toBe("no_estimate_found");
    });
  },
);
