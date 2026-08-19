import { describe, expect, it } from "vitest";
import { validatePackSelection } from "@/features/product-catalog/domain/pack-selection";

/**
 * Spec capability "online-storefront", requirement "Mixed-flavor pack
 * selection": a customer must be able to choose individual flavors within a
 * docena/media docena pack, and an unavailable flavor must never be a
 * choosable option. This pure validator is the domain rule Phase 6's cart
 * use-case will call — see design's data model sketch (`pack`, `pack_slot`).
 */
describe("validatePackSelection", () => {
  const carneCuchillo = "flavor-carne-cuchillo";
  const pollo = "flavor-pollo";
  const jamonQueso = "flavor-jamon-queso";

  it("accepts a mixed selection that totals the pack's unit count with eligible, available flavors", () => {
    const result = validatePackSelection({
      unitCount: 12,
      eligibleFlavorIds: [carneCuchillo, pollo, jamonQueso],
      availableFlavorIds: [carneCuchillo, pollo, jamonQueso],
      selection: { [carneCuchillo]: 8, [pollo]: 4 },
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects a selection whose total does not match the pack's unit count", () => {
    const result = validatePackSelection({
      unitCount: 12,
      eligibleFlavorIds: [carneCuchillo, pollo],
      availableFlavorIds: [carneCuchillo, pollo],
      selection: { [carneCuchillo]: 8, [pollo]: 3 },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["selection must total exactly 12 units (got 11)"]);
  });

  it("rejects a flavor that is no longer available, even if it is eligible for the pack", () => {
    const result = validatePackSelection({
      unitCount: 12,
      eligibleFlavorIds: [carneCuchillo, pollo],
      availableFlavorIds: [carneCuchillo],
      selection: { [carneCuchillo]: 6, [pollo]: 6 },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([`flavor ${pollo} is not available`]);
  });

  it("rejects a flavor that is not eligible for this pack at all", () => {
    const result = validatePackSelection({
      unitCount: 6,
      eligibleFlavorIds: [carneCuchillo],
      availableFlavorIds: [carneCuchillo, jamonQueso],
      selection: { [carneCuchillo]: 3, [jamonQueso]: 3 },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([`flavor ${jamonQueso} is not eligible for this pack`]);
  });
});
