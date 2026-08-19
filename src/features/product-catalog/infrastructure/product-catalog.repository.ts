import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import {
  products,
  flavors,
  packs,
  packSlots,
  priceListItems,
  type NewProduct,
  type NewFlavor,
  type NewPack,
} from "@/infrastructure/db/schema";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";
import type Decimal from "decimal.js";

/**
 * Drizzle repository for the product-catalog capability. Read queries here
 * are the real I/O boundary behind the pure domain functions in
 * `product-catalog/domain/` (availability filtering, pack selection,
 * price computation) — this file wires them to Postgres, it holds no
 * business logic of its own.
 */

export async function insertProduct(row: NewProduct) {
  const [inserted] = await getDb().insert(products).values(row).returning();
  return inserted;
}

export async function listProducts() {
  return getDb().select().from(products);
}

export async function insertFlavor(row: NewFlavor) {
  const [inserted] = await getDb().insert(flavors).values(row).returning();
  return inserted;
}

export async function listFlavorsByProduct(productId: string) {
  return getDb().select().from(flavors).where(eq(flavors.productId, productId));
}

/**
 * The availability toggle (spec scenario "Toggle hides from storefront").
 * Admin-only — enforced by the calling use-case, not here.
 */
export async function setFlavorAvailability(flavorId: string, isAvailable: boolean) {
  const [updated] = await getDb()
    .update(flavors)
    .set({ isAvailable })
    .where(eq(flavors.id, flavorId))
    .returning();
  return updated;
}

export async function listAvailableFlavors() {
  return getDb().select().from(flavors).where(eq(flavors.isAvailable, true));
}

export async function insertPack(row: NewPack) {
  const [inserted] = await getDb().insert(packs).values(row).returning();
  return inserted;
}

export async function listPacks() {
  return getDb().select().from(packs);
}

/**
 * Replaces the full set of flavors eligible for `packId` with exactly
 * `flavorIds` (delete-then-insert, inside one call) — configuring a pack's
 * eligible flavors is a full replace, not an incremental add/remove.
 */
export async function setPackFlavors(packId: string, flavorIds: string[]) {
  const db = getDb();
  await db.delete(packSlots).where(eq(packSlots.packId, packId));

  if (flavorIds.length === 0) {
    return [];
  }

  return db
    .insert(packSlots)
    .values(flavorIds.map((flavorId) => ({ packId, flavorId })))
    .returning();
}

/**
 * The "choosable flavors" query for a pack (spec scenario "Unavailable
 * flavor excluded from pack"): only flavors that are BOTH eligible for this
 * pack AND currently available. Feeds Phase 6's cart use-case together with
 * `pack-selection.ts`.
 */
export async function listChoosableFlavorsForPack(packId: string) {
  const slots = await getDb().select().from(packSlots).where(eq(packSlots.packId, packId));
  const eligibleFlavorIds = slots.map((slot) => slot.flavorId);

  if (eligibleFlavorIds.length === 0) {
    return [];
  }

  return getDb()
    .select()
    .from(flavors)
    .where(and(inArray(flavors.id, eligibleFlavorIds), eq(flavors.isAvailable, true)));
}

export async function upsertPriceListItem(
  flavorId: string,
  channel: SalesChannel,
  price: Decimal.Value,
) {
  const db = getDb();
  const existing = await db
    .select()
    .from(priceListItems)
    .where(and(eq(priceListItems.flavorId, flavorId), eq(priceListItems.channel, channel)));

  const priceString = price.toString();

  if (existing[0]) {
    const [updated] = await db
      .update(priceListItems)
      .set({ price: priceString, computedAt: new Date() })
      .where(eq(priceListItems.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(priceListItems)
    .values({ flavorId, channel, price: priceString })
    .returning();
  return inserted;
}

export async function listPriceListItems(flavorId: string) {
  return getDb().select().from(priceListItems).where(eq(priceListItems.flavorId, flavorId));
}
