import { eq } from "drizzle-orm";
import type Decimal from "decimal.js";
import { getDb } from "@/infrastructure/db/client";
import { discountCodes, shippingRates, type NewDiscountCode } from "@/infrastructure/db/schema";

/**
 * Drizzle repository for the online-storefront capability's discount codes.
 * Holds no business logic of its own — validation/discount math lives in the
 * pure `domain/discount.ts` (mirrors the split established by
 * `product-catalog.repository.ts` and `sales-order.repository.ts`).
 */

/**
 * Upserts a discount code keyed by its unique `code` (update-if-exists,
 * insert otherwise) — mirrors `upsertPriceListItem`'s select-then-update/
 * insert pattern in `product-catalog.repository.ts`. A second write for the
 * same code updates its type/value/active in place rather than duplicating
 * the row.
 */
export async function upsertDiscountCode(row: NewDiscountCode) {
  const db = getDb();
  const existing = await db.select().from(discountCodes).where(eq(discountCodes.code, row.code));

  if (existing[0]) {
    const [updated] = await db
      .update(discountCodes)
      .set({ type: row.type, value: row.value, active: row.active })
      .where(eq(discountCodes.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(discountCodes).values(row).returning();
  return inserted;
}

/**
 * Fetches a discount code by its `code` (or `undefined` if it does not
 * exist). Feeds Phase 6's cart use-case together with
 * `domain/discount.ts#applyDiscountCode`.
 */
export async function getDiscountCodeByCode(code: string) {
  const rows = await getDb().select().from(discountCodes).where(eq(discountCodes.code, code));
  return rows[0];
}

/**
 * Upserts a shipping rate keyed by its unique `postalCodePrefix` —
 * mirrors `upsertDiscountCode`'s select-then-update/insert pattern exactly.
 * A second write for the same prefix updates its rate in place rather than
 * duplicating the row (spec "Shipping cost by postal code", admin-editable).
 */
export async function upsertShippingRate(postalCodePrefix: string, rate: Decimal.Value) {
  const db = getDb();
  const existing = await db
    .select()
    .from(shippingRates)
    .where(eq(shippingRates.postalCodePrefix, postalCodePrefix));

  const rateString = rate.toString();

  if (existing[0]) {
    const [updated] = await db
      .update(shippingRates)
      .set({ rate: rateString })
      .where(eq(shippingRates.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(shippingRates)
    .values({ postalCodePrefix, rate: rateString })
    .returning();
  return inserted;
}

/**
 * Fetches every configured shipping rate. Feeds Phase 6b's checkout total
 * computation together with `domain/shipping.ts#resolveShippingCost`.
 */
export async function listShippingRates() {
  return getDb().select().from(shippingRates);
}
