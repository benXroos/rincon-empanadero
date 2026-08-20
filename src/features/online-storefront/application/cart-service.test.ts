import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartValidationError, type Cart } from "@/features/online-storefront/domain/cart";

const { getPackByIdMock, listEligibleFlavorsForPackMock, listAvailableFlavorsMock } = vi.hoisted(
  () => ({
    getPackByIdMock: vi.fn(),
    listEligibleFlavorsForPackMock: vi.fn(),
    listAvailableFlavorsMock: vi.fn(),
  }),
);

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  getPackById: getPackByIdMock,
  listEligibleFlavorsForPack: listEligibleFlavorsForPackMock,
  listAvailableFlavors: listAvailableFlavorsMock,
}));

const { addFlavorToCart, addPackToCart } =
  await import("@/features/online-storefront/application/cart-service");

/**
 * Wires the pure `domain/cart.ts` validators to the DB-resolved sets they
 * need (spec "Mixed-flavor pack selection" + individually-sold flavors).
 * Public — reachable by an anonymous customer, no `requireRole` call, same
 * as `browse-catalog.ts`.
 */
describe("cart-service", () => {
  const emptyCart: Cart = { lines: [] };
  const carneCuchillo = "flavor-carne-cuchillo";
  const pollo = "flavor-pollo";

  beforeEach(() => {
    getPackByIdMock.mockReset();
    listEligibleFlavorsForPackMock.mockReset();
    listAvailableFlavorsMock.mockReset();
  });

  describe("addFlavorToCart", () => {
    it("adds an available individually-sold flavor to the cart", async () => {
      listAvailableFlavorsMock.mockResolvedValueOnce([{ id: carneCuchillo, isAvailable: true }]);

      const cart = await addFlavorToCart(emptyCart, { flavorId: carneCuchillo, quantity: 3 });

      expect(cart.lines).toEqual([{ itemType: "flavor", flavorId: carneCuchillo, quantity: 3 }]);
    });

    it("rejects a flavor that is not currently available", async () => {
      listAvailableFlavorsMock.mockResolvedValueOnce([{ id: pollo, isAvailable: true }]);

      await expect(
        addFlavorToCart(emptyCart, { flavorId: carneCuchillo, quantity: 1 }),
      ).rejects.toThrow(CartValidationError);
    });
  });

  describe("addPackToCart", () => {
    const packId = "pack-docena";

    it("rejects a pack id that does not exist", async () => {
      getPackByIdMock.mockResolvedValueOnce(undefined);

      await expect(
        addPackToCart(emptyCart, { packId, selection: { [carneCuchillo]: 12 } }),
      ).rejects.toThrow(CartValidationError);
    });

    it("adds a mixed-flavor pack line validated against eligibility and availability", async () => {
      getPackByIdMock.mockResolvedValueOnce({ id: packId, unitCount: 12 });
      listEligibleFlavorsForPackMock.mockResolvedValueOnce([{ id: carneCuchillo }, { id: pollo }]);
      listAvailableFlavorsMock.mockResolvedValueOnce([{ id: carneCuchillo }, { id: pollo }]);

      const cart = await addPackToCart(emptyCart, {
        packId,
        selection: { [carneCuchillo]: 8, [pollo]: 4 },
      });

      expect(cart.lines).toEqual([
        { itemType: "pack", packId, selection: { [carneCuchillo]: 8, [pollo]: 4 } },
      ]);
    });

    it("rejects a selection referencing a flavor that is eligible but no longer available", async () => {
      getPackByIdMock.mockResolvedValueOnce({ id: packId, unitCount: 12 });
      listEligibleFlavorsForPackMock.mockResolvedValueOnce([{ id: carneCuchillo }, { id: pollo }]);
      listAvailableFlavorsMock.mockResolvedValueOnce([{ id: carneCuchillo }]);

      await expect(
        addPackToCart(emptyCart, { packId, selection: { [carneCuchillo]: 6, [pollo]: 6 } }),
      ).rejects.toThrow(CartValidationError);
    });
  });
});
