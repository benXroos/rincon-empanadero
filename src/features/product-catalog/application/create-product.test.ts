import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";

const { requireRoleMock, insertProductMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertProductMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/product-catalog/infrastructure/product-catalog.repository", () => ({
  insertProduct: insertProductMock,
}));

const { createProduct } = await import("@/features/product-catalog/application/create-product");

describe("createProduct (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertProductMock.mockReset();
  });

  it("denies a colaborador and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(createProduct({ name: "Empanada" })).rejects.toThrow(UnauthorizedError);

    expect(insertProductMock).not.toHaveBeenCalled();
  });

  it("allows an admin and inserts the product with the given name", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertProductMock.mockResolvedValueOnce({ id: "product-1", name: "Empanada" });

    const resultado = await createProduct({ name: "Empanada" });

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(insertProductMock).toHaveBeenCalledWith({ name: "Empanada" });
    expect(resultado.id).toBe("product-1");
  });
});
