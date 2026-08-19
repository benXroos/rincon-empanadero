import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, insertPackMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertPackMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  insertPack: insertPackMock,
}));

const { createPack } = await import("@/features/product-catalog/application/create-pack");

const VALID_INPUT = { name: "Docena", unitCount: 12 };

describe("createPack (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertPackMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(createPack(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertPackMock).not.toHaveBeenCalled();
  });

  it("allows an admin and inserts the pack with the given unit count", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertPackMock.mockResolvedValueOnce({ id: "pack-1", ...VALID_INPUT });

    const resultado = await createPack(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(insertPackMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(resultado.id).toBe("pack-1");
  });
});
