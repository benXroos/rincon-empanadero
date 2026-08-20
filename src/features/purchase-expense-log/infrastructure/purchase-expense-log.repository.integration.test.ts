import { config } from "dotenv";
config({ path: ".env.local" });

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { products, flavors, purchaseLogs, decomisoLogs } from "@/infrastructure/db/schema";
import {
  insertPurchaseLog,
  listPurchaseLogs,
  listPurchaseLogsInRange,
  insertDecomisoLog,
  listDecomisoLogs,
  listDecomisoLogsInRange,
} from "@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository";
import {
  insertProduct,
  insertFlavor,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";

/**
 * Real Neon Postgres round-trip test — same
 * `import { config } from "dotenv"; config({ path: ".env.local" });` +
 * `describe.skipIf(!hasDatabase)` pattern established since Phase 3.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("purchase-expense-log repository (live Neon integration)", () => {
  const createdPurchaseLogIds: string[] = [];
  const createdDecomisoLogIds: string[] = [];
  const createdFlavorIds: string[] = [];
  const createdProductIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of createdPurchaseLogIds.splice(0)) {
      await db.delete(purchaseLogs).where(eq(purchaseLogs.id, id));
    }
    for (const id of createdDecomisoLogIds.splice(0)) {
      await db.delete(decomisoLogs).where(eq(decomisoLogs.id, id));
    }
    for (const id of createdFlavorIds.splice(0)) {
      await db.delete(flavors).where(eq(flavors.id, id));
    }
    for (const id of createdProductIds.splice(0)) {
      await db.delete(products).where(eq(products.id, id));
    }
  });

  it("persists a purchase log and reads it back unchanged", async () => {
    const inserted = await insertPurchaseLog({
      itemName: "Bolsas de papel",
      category: "packaging",
      quantity: "50",
      unitPrice: "120.5000",
      totalCost: "6025",
      purchaseDate: new Date("2026-08-10T12:00:00Z"),
    });
    createdPurchaseLogIds.push(inserted.id);

    const all = await listPurchaseLogs();
    const found = all.find((row) => row.id === inserted.id);

    expect(found?.itemName).toBe("Bolsas de papel");
    expect(found?.category).toBe("packaging");
    expect(found?.totalCost).toBe("6025.0000");
  });

  it("finds a purchase log within its own week and not the following week's date range", async () => {
    const inserted = await insertPurchaseLog({
      itemName: "Carne para relleno",
      category: "proteins_dairy",
      quantity: "20",
      unitPrice: "3000",
      totalCost: "60000",
      purchaseDate: new Date("2026-08-10T12:00:00Z"),
    });
    createdPurchaseLogIds.push(inserted.id);

    const sameWeek = await listPurchaseLogsInRange(
      new Date("2026-08-10T00:00:00Z"),
      new Date("2026-08-11T00:00:00Z"),
    );
    expect(sameWeek.find((row) => row.id === inserted.id)?.totalCost).toBe("60000.0000");

    const nextWeek = await listPurchaseLogsInRange(
      new Date("2026-08-17T00:00:00Z"),
      new Date("2026-08-24T00:00:00Z"),
    );
    expect(nextWeek.find((row) => row.id === inserted.id)).toBeUndefined();
  });

  it("persists a decomiso log against a real flavor and reads it back unchanged", async () => {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await insertProduct({ name: `Empanada ${suffix}` });
    createdProductIds.push(product.id);
    const flavor = await insertFlavor({
      productId: product.id,
      name: `Carne mechada ${suffix}`,
      costoMateriales: "1000.0000",
    });
    createdFlavorIds.push(flavor.id);

    const inserted = await insertDecomisoLog({
      flavorId: flavor.id,
      quantityWasted: "4",
      wasteDate: new Date("2026-08-10T12:00:00Z"),
      reason: "Se pasó la fecha",
    });
    createdDecomisoLogIds.push(inserted.id);

    const all = await listDecomisoLogs();
    const found = all.find((row) => row.id === inserted.id);

    expect(found?.flavorId).toBe(flavor.id);
    expect(found?.quantityWasted).toBe("4.0000");
    expect(found?.reason).toBe("Se pasó la fecha");
  });

  it("finds a decomiso log within its own week and not the following week's date range", async () => {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await insertProduct({ name: `Empanada ${suffix}` });
    createdProductIds.push(product.id);
    const flavor = await insertFlavor({
      productId: product.id,
      name: `Pollo ${suffix}`,
      costoMateriales: "800.0000",
    });
    createdFlavorIds.push(flavor.id);

    const inserted = await insertDecomisoLog({
      flavorId: flavor.id,
      quantityWasted: "2.5",
      wasteDate: new Date("2026-08-10T12:00:00Z"),
    });
    createdDecomisoLogIds.push(inserted.id);

    const sameWeek = await listDecomisoLogsInRange(
      new Date("2026-08-10T00:00:00Z"),
      new Date("2026-08-11T00:00:00Z"),
    );
    expect(sameWeek.find((row) => row.id === inserted.id)?.quantityWasted).toBe("2.5000");

    const nextWeek = await listDecomisoLogsInRange(
      new Date("2026-08-17T00:00:00Z"),
      new Date("2026-08-24T00:00:00Z"),
    );
    expect(nextWeek.find((row) => row.id === inserted.id)).toBeUndefined();
  });
});
