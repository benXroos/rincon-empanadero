"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { setFlavorAvailability } from "@/features/product-catalog/infrastructure/product-catalog.repository";

/**
 * Admin-only use-case for the availability toggle (spec requirement
 * "Availability toggle" / scenario "Toggle hides from storefront").
 * requireRole() is awaited BEFORE the repository call, so a denied
 * colaborador never flips availability — see the colaborador-denied test.
 * There is no cache in front of `flavors.is_available`, so the change is
 * visible to `listChoosableFlavorsForPack` on the very next read — this IS
 * the "immediately" guarantee the spec scenario requires.
 */
export interface ToggleAvailabilityInput {
  flavorId: string;
  isAvailable: boolean;
}

export async function toggleAvailability(input: ToggleAvailabilityInput) {
  await requireRole(["admin"]);

  return setFlavorAvailability(input.flavorId, input.isAvailable);
}
