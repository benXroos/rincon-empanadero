import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, insertFlavorMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertFlavorMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  insertFlavor: insertFlavorMock,
}));

const { createFlavor } = await import("@/features/product-catalog/application/create-flavor");

const VALID_INPUT = {
  productId: "product-1",
  name: "Carne cuchillo",
  costoMateriales: "1003.4096",
};

describe("createFlavor (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertFlavorMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(createFlavor(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertFlavorMock).not.toHaveBeenCalled();
  });

  it("allows an admin and inserts the flavor with the given cost", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertFlavorMock.mockResolvedValueOnce({ id: "flavor-1", ...VALID_INPUT });

    const resultado = await createFlavor(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(insertFlavorMock).toHaveBeenCalledWith(VALID_INPUT);
    expect(resultado.id).toBe("flavor-1");
  });
});
