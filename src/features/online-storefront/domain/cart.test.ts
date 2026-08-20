import { describe, expect, it } from "vitest";
import {
  addFlavorLine,
  addPackLine,
  CartValidationError,
  type Cart,
} from "@/features/online-storefront/domain/cart";

/**
 * Spec capability "online-storefront": cart management supporting BOTH
 * individually-sold flavors AND mixed-flavor pack lines (spec "Mixed-flavor
 * pack selection" — the fix for the old Empretienda one-flavor-per-pack
 * limitation). No DB/date/env/framework imports — pack-slot
 * eligibility/availability is validated by the already-tested
 * `product-catalog/domain/pack-selection.ts#validatePackSelection`, which
 * this module calls rather than reimplements (per the tasks note).
 */
describe("cart", () => {
  const emptyCart: Cart = { lines: [] };
  const carneCuchillo = "flavor-carne-cuchillo";
  const pollo = "flavor-pollo";

  describe("addFlavorLine", () => {
    it("appends an individually-sold flavor line to the cart", () => {
      const cart = addFlavorLine(emptyCart, { flavorId: carneCuchillo, quantity: 3 });

      expect(cart.lines).toEqual([{ itemType: "flavor", flavorId: carneCuchillo, quantity: 3 }]);
    });

    it("rejects a non-positive quantity", () => {
      expect(() => addFlavorLine(emptyCart, { flavorId: carneCuchillo, quantity: 0 })).toThrow(
        CartValidationError,
      );
    });

    it("does not mutate the cart passed in (pure)", () => {
      addFlavorLine(emptyCart, { flavorId: carneCuchillo, quantity: 1 });

      expect(emptyCart.lines).toEqual([]);
    });
  });

  describe("addPackLine", () => {
    const docena = { id: "pack-docena", unitCount: 12 };

    it("appends a mixed-flavor pack line whose selection totals the pack's unit count with eligible, available flavors", () => {
      const cart = addPackLine(emptyCart, {
        pack: docena,
        eligibleFlavorIds: [carneCuchillo, pollo],
        availableFlavorIds: [carneCuchillo, pollo],
        selection: { [carneCuchillo]: 8, [pollo]: 4 },
      });

      expect(cart.lines).toEqual([
        {
          itemType: "pack",
          packId: docena.id,
          selection: { [carneCuchillo]: 8, [pollo]: 4 },
        },
      ]);
    });

    it("rejects a selection that includes a flavor no longer available, even if eligible for the pack", () => {
      expect(() =>
        addPackLine(emptyCart, {
          pack: docena,
          eligibleFlavorIds: [carneCuchillo, pollo],
          availableFlavorIds: [carneCuchillo],
          selection: { [carneCuchillo]: 6, [pollo]: 6 },
        }),
      ).toThrow(CartValidationError);
    });

    it("rejects a selection that does not total the pack's unit count", () => {
      expect(() =>
        addPackLine(emptyCart, {
          pack: docena,
          eligibleFlavorIds: [carneCuchillo, pollo],
          availableFlavorIds: [carneCuchillo, pollo],
          selection: { [carneCuchillo]: 8, [pollo]: 3 },
        }),
      ).toThrow(CartValidationError);
    });

    it("does not mutate the cart passed in (pure)", () => {
      addPackLine(emptyCart, {
        pack: docena,
        eligibleFlavorIds: [carneCuchillo],
        availableFlavorIds: [carneCuchillo],
        selection: { [carneCuchillo]: 12 },
      });

      expect(emptyCart.lines).toEqual([]);
    });
  });
});
