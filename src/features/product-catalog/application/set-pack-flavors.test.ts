import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, setPackFlavorsRepoMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  setPackFlavorsRepoMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  setPackFlavors: setPackFlavorsRepoMock,
}));

const { setPackFlavors } = await import("@/features/product-catalog/application/set-pack-flavors");

describe("setPackFlavors (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    setPackFlavorsRepoMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(
      setPackFlavors({ packId: "pack-1", flavorIds: ["flavor-1", "flavor-2"] }),
    ).rejects.toThrow(UnauthorizedError);

    expect(setPackFlavorsRepoMock).not.toHaveBeenCalled();
  });

  it("allows an admin and replaces the pack's eligible flavors with the given list", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    setPackFlavorsRepoMock.mockResolvedValueOnce([
      { packId: "pack-1", flavorId: "flavor-1" },
      { packId: "pack-1", flavorId: "flavor-2" },
    ]);

    const resultado = await setPackFlavors({
      packId: "pack-1",
      flavorIds: ["flavor-1", "flavor-2"],
    });

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(setPackFlavorsRepoMock).toHaveBeenCalledWith("pack-1", ["flavor-1", "flavor-2"]);
    expect(resultado).toHaveLength(2);
  });
});
