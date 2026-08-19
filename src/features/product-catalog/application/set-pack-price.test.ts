import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, upsertPackPriceListItemMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  upsertPackPriceListItemMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  upsertPackPriceListItem: upsertPackPriceListItemMock,
}));

const { setPackPrice } = await import("@/features/product-catalog/application/set-pack-price");

const VALID_INPUT = { packId: "pack-1", channel: "own" as const, price: "25000.00" };

/**
 * CORRECTION (post-Phase-3): a pack's price is its own admin-set fixed
 * value per channel, stored directly — never derived by summing its
 * chosen flavors' prices. Mirrors the existing `createPack`/`toggleAvailability`
 * admin-only server-action pattern.
 */
describe("setPackPrice (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    upsertPackPriceListItemMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(setPackPrice(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(upsertPackPriceListItemMock).not.toHaveBeenCalled();
  });

  it("allows an admin and stores the pack's fixed price for that channel", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    upsertPackPriceListItemMock.mockResolvedValueOnce({
      id: "price-1",
      packId: "pack-1",
      channel: "own",
      price: "25000.00",
    });

    const resultado = await setPackPrice(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(upsertPackPriceListItemMock).toHaveBeenCalledWith("pack-1", "own", "25000.00");
    expect(resultado.price).toBe("25000.00");
  });
});
