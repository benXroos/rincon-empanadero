import { config } from "dotenv";
config({ path: ".env.local" });

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import {
  products,
  flavors,
  packs,
  packSlots,
  priceListItems,
  packPriceListItems,
} from "@/infrastructure/db/schema";
import {
  insertProduct,
  insertFlavor,
  insertPack,
  setPackFlavors,
  setFlavorAvailability,
  listChoosableFlavorsForPack,
  upsertPriceListItem,
  listPriceListItems,
  upsertPackPriceListItem,
  listPackPriceListItems,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";

/**
 * Real Neon Postgres round-trip test. Closes the gap flagged in Phase 2's
 * apply-progress ("no live-DB integration test has ever run once in this
 * project") now that `DATABASE_URL` is provisioned in `.env.local`. Skips
 * gracefully — never hard-fails — in any environment without it (matching
 * `drizzle.config.ts`'s own `.env.local` loading pattern).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("product-catalog repository (live Neon integration)", () => {
  const createdProductIds: string[] = [];
  const createdFlavorIds: string[] = [];
  const createdPackIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const packId of createdPackIds.splice(0)) {
      await db.delete(packSlots).where(eq(packSlots.packId, packId));
      await db.delete(packPriceListItems).where(eq(packPriceListItems.packId, packId));
      await db.delete(packs).where(eq(packs.id, packId));
    }
    for (const flavorId of createdFlavorIds.splice(0)) {
      await db.delete(priceListItems).where(eq(priceListItems.flavorId, flavorId));
      await db.delete(flavors).where(eq(flavors.id, flavorId));
    }
    for (const productId of createdProductIds.splice(0)) {
      await db.delete(products).where(eq(products.id, productId));
    }
  });

  it("excludes an unavailable flavor from listChoosableFlavorsForPack even though it is eligible", async () => {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await insertProduct({ name: `Empanada ${suffix}` });
    createdProductIds.push(product.id);

    const carne = await insertFlavor({
      productId: product.id,
      name: `Carne cuchillo ${suffix}`,
      costoMateriales: "1003.4096",
    });
    const pollo = await insertFlavor({
      productId: product.id,
      name: `Pollo ${suffix}`,
      costoMateriales: "800.0000",
    });
    createdFlavorIds.push(carne.id, pollo.id);

    const docena = await insertPack({ name: `Docena ${suffix}`, unitCount: 12 });
    createdPackIds.push(docena.id);

    await setPackFlavors(docena.id, [carne.id, pollo.id]);
    await setFlavorAvailability(pollo.id, false);

    const choosable = await listChoosableFlavorsForPack(docena.id);

    expect(choosable.map((f) => f.id)).toEqual([carne.id]);
  });

  it("upserts a price_list_item so a second write for the same flavor+channel updates, not duplicates", async () => {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await insertProduct({ name: `Empanada ${suffix}` });
    createdProductIds.push(product.id);

    const flavor = await insertFlavor({
      productId: product.id,
      name: `Jamon y queso ${suffix}`,
      costoMateriales: "600.0000",
    });
    createdFlavorIds.push(flavor.id);

    await upsertPriceListItem(flavor.id, "own", "1500.00");
    await upsertPriceListItem(flavor.id, "own", "1600.00");

    const items = await listPriceListItems(flavor.id);

    expect(items).toHaveLength(1);
    expect(items[0]?.price).toBe("1600.00");
  });

  /**
   * CORRECTION: a pack's price is its OWN fixed price per channel, looked
   * up directly — never derived by summing its chosen flavors' prices.
   * Owner-confirmed real-site example this fixture mirrors: individual
   * empanada $2500, but Docena (12) = $25000 (well below the naive
   * 12×2500=$30000 sum).
   */
  it("upserts a pack_price_list_item so a second write for the same pack+channel updates, not duplicates", async () => {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const docena = await insertPack({ name: `Docena ${suffix}`, unitCount: 12 });
    createdPackIds.push(docena.id);

    await upsertPackPriceListItem(docena.id, "own", "25000.00");
    await upsertPackPriceListItem(docena.id, "own", "26000.00");

    const items = await listPackPriceListItems(docena.id);

    expect(items).toHaveLength(1);
    expect(items[0]?.price).toBe("26000.00");
  });

  it("keeps the pack's fixed price independent of the sum of its chosen flavors' prices", async () => {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await insertProduct({ name: `Empanada ${suffix}` });
    createdProductIds.push(product.id);

    const carne = await insertFlavor({
      productId: product.id,
      name: `Carne cuchillo ${suffix}`,
      costoMateriales: "1003.4096",
    });
    createdFlavorIds.push(carne.id);
    await upsertPriceListItem(carne.id, "own", "2500.00");

    const docena = await insertPack({ name: `Docena ${suffix}`, unitCount: 12 });
    createdPackIds.push(docena.id);
    await setPackFlavors(docena.id, [carne.id]);
    await upsertPackPriceListItem(docena.id, "own", "25000.00");

    const items = await listPackPriceListItems(docena.id);

    // Naive sum would be 12 × 2500.00 = 30000.00 — the fixed pack price
    // must NOT equal that naive sum.
    expect(items[0]?.price).toBe("25000.00");
    expect(items[0]?.price).not.toBe("30000.00");
  });
});
