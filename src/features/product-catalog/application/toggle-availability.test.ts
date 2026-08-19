import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, setFlavorAvailabilityMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  setFlavorAvailabilityMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  setFlavorAvailability: setFlavorAvailabilityMock,
}));

const { toggleAvailability } =
  await import("@/features/product-catalog/application/toggle-availability");

describe("toggleAvailability (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    setFlavorAvailabilityMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(toggleAvailability({ flavorId: "flavor-1", isAvailable: false })).rejects.toThrow(
      UnauthorizedError,
    );

    expect(setFlavorAvailabilityMock).not.toHaveBeenCalled();
  });

  it("allows an admin and immediately persists the new availability", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    setFlavorAvailabilityMock.mockResolvedValueOnce({ id: "flavor-1", isAvailable: false });

    const resultado = await toggleAvailability({ flavorId: "flavor-1", isAvailable: false });

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(setFlavorAvailabilityMock).toHaveBeenCalledWith("flavor-1", false);
    expect(resultado.isAvailable).toBe(false);
  });
});
