import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";
import { PurchaseValidationError } from "@/features/purchase-expense-log/domain/compute-purchase-total";

const { requireRoleMock, insertPurchaseLogMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertPurchaseLogMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository", () => ({
  insertPurchaseLog: insertPurchaseLogMock,
}));

const { registerPurchase } =
  await import("@/features/purchase-expense-log/application/register-purchase");

const VALID_INPUT = {
  itemName: "Bolsas de papel",
  category: "packaging" as const,
  quantity: "50",
  unitPrice: "120.50",
  purchaseDate: new Date("2026-08-10T12:00:00Z"),
};

/**
 * Owner-confirmed permission boundary: both admin and colaborador can
 * register purchases (`requireRole(["admin", "colaborador"])`), matching
 * `registerSale`'s boundary.
 */
describe("registerPurchase (admin and colaborador server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertPurchaseLogMock.mockReset();
  });

  it("denies an unauthenticated caller and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(registerPurchase(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertPurchaseLogMock).not.toHaveBeenCalled();
  });

  it("allows an admin and persists the purchase with its computed total cost", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertPurchaseLogMock.mockResolvedValueOnce({ id: "purchase-1", ...VALID_INPUT });

    const resultado = await registerPurchase(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin", "colaborador"]);
    expect(insertPurchaseLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        itemName: "Bolsas de papel",
        category: "packaging",
        quantity: "50",
        unitPrice: "120.5",
        totalCost: "6025",
      }),
    );
    expect(resultado.id).toBe("purchase-1");
  });

  it("allows a colaborador and persists the purchase (triangulation on role)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "colaborador" } });
    insertPurchaseLogMock.mockResolvedValueOnce({ id: "purchase-3", ...VALID_INPUT });

    const resultado = await registerPurchase(VALID_INPUT);

    expect(resultado.id).toBe("purchase-3");
  });

  it("computes a different total for a different quantity/unit price (triangulation)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertPurchaseLogMock.mockResolvedValueOnce({ id: "purchase-2" });

    await registerPurchase({
      itemName: "Carne para relleno",
      category: "proteins_dairy",
      quantity: "20",
      unitPrice: "3000",
      purchaseDate: new Date("2026-08-10T12:00:00Z"),
    });

    expect(insertPurchaseLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ totalCost: "60000" }),
    );
  });

  it("rejects a zero quantity before ever calling the repository (domain validation)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });

    await expect(
      registerPurchase({
        itemName: "Bolsas de papel",
        category: "packaging",
        quantity: "0",
        unitPrice: "100",
        purchaseDate: new Date("2026-08-10T12:00:00Z"),
      }),
    ).rejects.toThrow(PurchaseValidationError);

    expect(insertPurchaseLogMock).not.toHaveBeenCalled();
  });
});
