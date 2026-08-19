/**
 * Pure mixed-flavor pack selection validator (spec capability
 * "online-storefront", requirement "Mixed-flavor pack selection" — fixes the
 * old Empretienda limitation of one flavor per pack). Phase 6's cart
 * use-case calls this with the pack's eligible flavors (`pack_slot` rows)
 * and the currently available flavors (`flavor.is_available`) so an
 * unavailable flavor is rejected even if it was eligible when the pack was
 * configured — see spec scenario "Unavailable flavor excluded from pack".
 */
export interface PackSelectionInput {
  unitCount: number;
  eligibleFlavorIds: string[];
  availableFlavorIds: string[];
  selection: Record<string, number>;
}

export interface PackSelectionResult {
  valid: boolean;
  errors: string[];
}

export function validatePackSelection(input: PackSelectionInput): PackSelectionResult {
  const errors: string[] = [];
  const chosenFlavorIds = Object.keys(input.selection);

  const totalQty = chosenFlavorIds.reduce((sum, id) => sum + (input.selection[id] ?? 0), 0);
  if (totalQty !== input.unitCount) {
    errors.push(`selection must total exactly ${input.unitCount} units (got ${totalQty})`);
  }

  for (const flavorId of chosenFlavorIds) {
    const qty = input.selection[flavorId] ?? 0;

    if (qty <= 0) {
      errors.push(`quantity for flavor ${flavorId} must be positive`);
      continue;
    }

    if (!input.eligibleFlavorIds.includes(flavorId)) {
      errors.push(`flavor ${flavorId} is not eligible for this pack`);
      continue;
    }

    if (!input.availableFlavorIds.includes(flavorId)) {
      errors.push(`flavor ${flavorId} is not available`);
    }
  }

  return { valid: errors.length === 0, errors };
}
