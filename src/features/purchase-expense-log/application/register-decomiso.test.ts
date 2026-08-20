import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";
import { DecomisoValidationError } from "@/features/purchase-expense-log/domain/validate-decomiso-entry";

const { requireRoleMock, insertDecomisoLogMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertDecomisoLogMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository", () => ({
  insertDecomisoLog: insertDecomisoLogMock,
}));

const { registerDecomiso } =
  await import("@/features/purchase-expense-log/application/register-decomiso");

const VALID_INPUT = {
  flavorId: "flavor-1",
  quantityWasted: "4",
  wasteDate: new Date("2026-08-10T12:00:00Z"),
  reason: "Se pasó la fecha",
};

/**
 * Same admin-only permission boundary as `registerPurchase` — decomiso
 * (waste) logging is a write to the same capability, no spec scenario
 * grants colaborador write access to it.
 */
describe("registerDecomiso (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertDecomisoLogMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(registerDecomiso(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertDecomisoLogMock).not.toHaveBeenCalled();
  });

  it("allows an admin and persists the decomiso entry with its validated quantity", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertDecomisoLogMock.mockResolvedValueOnce({ id: "decomiso-1", ...VALID_INPUT });

    const resultado = await registerDecomiso(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(insertDecomisoLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flavorId: "flavor-1",
        quantityWasted: "4",
        reason: "Se pasó la fecha",
      }),
    );
    expect(resultado.id).toBe("decomiso-1");
  });

  it("allows an admin to log a decomiso entry with no reason (optional field, triangulation)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertDecomisoLogMock.mockResolvedValueOnce({ id: "decomiso-2" });

    await registerDecomiso({
      flavorId: "flavor-2",
      quantityWasted: "1.5",
      wasteDate: new Date("2026-08-10T12:00:00Z"),
    });

    expect(insertDecomisoLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ flavorId: "flavor-2", quantityWasted: "1.5" }),
    );
  });

  it("rejects a zero quantity wasted before ever calling the repository (domain validation)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });

    await expect(
      registerDecomiso({
        flavorId: "flavor-1",
        quantityWasted: "0",
        wasteDate: new Date("2026-08-10T12:00:00Z"),
      }),
    ).rejects.toThrow(DecomisoValidationError);

    expect(insertDecomisoLogMock).not.toHaveBeenCalled();
  });
});
