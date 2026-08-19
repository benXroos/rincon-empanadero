import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, insertPricingProfileVersionMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertPricingProfileVersionMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/pricing/infrastructure/pricing-profile.repository", () => ({
  insertPricingProfileVersion: insertPricingProfileVersionMock,
}));

const { updatePricingProfile } =
  await import("@/features/pricing/application/update-pricing-profile");

const VALID_INPUT = {
  channel: "own" as const,
  effectiveFrom: new Date("2026-08-19T00:00:00Z"),
  decomisoPct: "0.10",
  gananciaDeseadaPct: "0.35",
  comisionPlataformaPct: "0.23",
  ivaComisionPct: "0.21",
  comisionTarjetasPct: "0.03",
};

describe("updatePricingProfile (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertPricingProfileVersionMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(updatePricingProfile(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertPricingProfileVersionMock).not.toHaveBeenCalled();
  });

  it("allows an admin and inserts a new pricing_profile version with the given percentages", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertPricingProfileVersionMock.mockResolvedValueOnce({ id: "new-version-id", ...VALID_INPUT });

    const resultado = await updatePricingProfile(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(insertPricingProfileVersionMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(resultado.id).toBe("new-version-id");
  });
});
