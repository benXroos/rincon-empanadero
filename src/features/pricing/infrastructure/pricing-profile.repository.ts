import { desc, eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { pricingProfiles, type NewPricingProfileRow } from "@/infrastructure/db/schema";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";

/**
 * Drizzle repository for `pricing_profiles`. Append-only per design decision
 * #7 — this repository exposes `insertVersion`, never `update`/`delete`, so
 * repricing can only ever add a new version, never rewrite an existing one.
 *
 * NOTE: this file is NOT covered by an executed live-DB round-trip test in
 * this batch — no DATABASE_URL/live Neon branch is available in this sandbox
 * (see apply-progress). The version/channel-selection BEHAVIOR this
 * repository depends on is fully unit-tested as a pure function in
 * `resolve-active-profile.test.ts`; this file only wires that pure logic to
 * real I/O and type-checks against the generated schema/migration.
 */
export async function insertPricingProfileVersion(row: NewPricingProfileRow) {
  const [inserted] = await getDb().insert(pricingProfiles).values(row).returning();
  return inserted;
}

export async function listPricingProfileVersions(channel: SalesChannel) {
  return getDb()
    .select()
    .from(pricingProfiles)
    .where(eq(pricingProfiles.channel, channel))
    .orderBy(desc(pricingProfiles.effectiveFrom));
}
