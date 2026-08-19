import type { Decimal } from "decimal.js";

/**
 * Pure versioning logic for pricing profiles (design decision #7).
 * `pricing_profile` rows are append-only per channel: a new percentage
 * change is a NEW row with a new `effectiveFrom`, never an update to an
 * existing row. This lets an order snapshot its cost breakdown at creation
 * time and stay correct forever, even after later profile versions are
 * added — repricing must never rewrite history.
 */
export type SalesChannel = "own" | "pedidosya";

export interface PricingProfileVersion {
  channel: SalesChannel;
  effectiveFrom: Date;
  decomisoPct: Decimal.Value;
  gananciaDeseadaPct: Decimal.Value;
  comisionPlataformaPct: Decimal.Value;
  ivaComisionPct: Decimal.Value;
  comisionTarjetasPct: Decimal.Value;
}

/**
 * Returns the profile version for `channel` that was effective at `asOf`:
 * the most recent version whose `effectiveFrom` is at or before `asOf`.
 * Returns `undefined` if no version of that channel existed yet at `asOf`.
 */
export function resolveActiveProfile(
  profiles: PricingProfileVersion[],
  channel: SalesChannel,
  asOf: Date,
): PricingProfileVersion | undefined {
  const candidatos = profiles
    .filter((p) => p.channel === channel && p.effectiveFrom.getTime() <= asOf.getTime())
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

  return candidatos[0];
}
