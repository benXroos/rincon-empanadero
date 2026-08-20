import {
  listAvailableFlavors,
  listPacks,
  listChoosableFlavorsForPack,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";

/**
 * Public storefront catalog browsing (spec capability "online-storefront").
 * Unlike every prior mutating use-case in this project, this is a read-only
 * query reachable by an ANONYMOUS customer — no `requireRole`/
 * `requireSession` call here, by design: the spec's availability toggle
 * ("Toggle hides from storefront") must take effect for anyone browsing,
 * not just logged-in staff. Thin wiring only — no business logic of its
 * own, matching the split `product-catalog.repository.ts` already
 * establishes.
 */

/** Individually-sold flavors currently orderable (respects `is_available`). */
export async function browseAvailableFlavors() {
  return listAvailableFlavors();
}

/** All packs (docena/media docena) — packs carry no `is_available` toggle of their own. */
export async function browsePacks() {
  return listPacks();
}

/**
 * A pack's choosable flavor options for the customer-facing selection UI
 * (spec scenario "Unavailable flavor excluded from pack") — already
 * intersects eligibility with current availability.
 */
export async function browsePackFlavorOptions(packId: string) {
  return listChoosableFlavorsForPack(packId);
}
