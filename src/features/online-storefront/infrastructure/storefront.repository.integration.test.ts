import "@/test/load-test-env";

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { discountCodes, shippingRates } from "@/infrastructure/db/schema";
import {
  upsertDiscountCode,
  getDiscountCodeByCode,
  upsertShippingRate,
  listShippingRates,
} from "@/features/online-storefront/infrastructure/storefront.repository";

/**
 * Real Neon Postgres round-trip test, matching the pattern established by
 * `product-catalog.repository.integration.test.ts` and
 * `sales-order.repository.integration.test.ts`.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)(
  "storefront repository — discount codes (live Neon integration)",
  () => {
    const createdCodes: string[] = [];

    afterEach(async () => {
      const db = getDb();
      for (const code of createdCodes.splice(0)) {
        await db.delete(discountCodes).where(eq(discountCodes.code, code));
      }
    });

    it("upserts a discount code so a second write for the same code updates, not duplicates", async () => {
      const code = `PROMO-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      createdCodes.push(code);

      await upsertDiscountCode({ code, type: "percentage", value: "10", active: true });
      await upsertDiscountCode({ code, type: "percentage", value: "15", active: true });

      const found = await getDiscountCodeByCode(code);

      expect(found?.value).toBe("15.00");
    });

    it("returns undefined for a code that does not exist", async () => {
      const found = await getDiscountCodeByCode("DOES-NOT-EXIST");

      expect(found).toBeUndefined();
    });
  },
);

describe.skipIf(!hasDatabase)(
  "storefront repository — shipping rates (live Neon integration)",
  () => {
    const createdPrefixes: string[] = [];

    afterEach(async () => {
      const db = getDb();
      for (const prefix of createdPrefixes.splice(0)) {
        await db.delete(shippingRates).where(eq(shippingRates.postalCodePrefix, prefix));
      }
    });

    it("upserts a shipping rate so a second write for the same prefix updates, not duplicates", async () => {
      const prefix = `TESTPFX-${Date.now()}`;
      createdPrefixes.push(prefix);

      await upsertShippingRate(prefix, "1000.00");
      await upsertShippingRate(prefix, "1500.00");

      const rates = await listShippingRates();
      const found = rates.find((rate) => rate.postalCodePrefix === prefix);

      expect(found?.rate).toBe("1500.00");
    });
  },
);
