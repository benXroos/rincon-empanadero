"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { insertPricingProfileVersion } from "@/features/pricing/infrastructure/pricing-profile.repository";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";

/**
 * Admin-only use-case for editing pricing percentages (spec requirement
 * "Admin-editable percentages"). Per design decision #7, this NEVER updates
 * an existing pricing_profile row — it always inserts a new version, so a
 * percentage change takes effect immediately for future calculations
 * without altering any already-snapshotted order cost.
 *
 * requireRole() is awaited BEFORE the repository call, so a denied
 * colaborador never reaches insertPricingProfileVersion — see the
 * colaborador-denied test in update-pricing-profile.test.ts.
 */
export interface UpdatePricingProfileInput {
  channel: SalesChannel;
  effectiveFrom: Date;
  decomisoPct: string;
  gananciaDeseadaPct: string;
  comisionPlataformaPct: string;
  ivaComisionPct: string;
  comisionTarjetasPct: string;
}

export async function updatePricingProfile(input: UpdatePricingProfileInput) {
  await requireRole(["admin"]);

  return insertPricingProfileVersion(input);
}
