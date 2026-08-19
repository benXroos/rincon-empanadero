import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";
import { SaleValidationError } from "@/features/sales-orders/domain/compute-sale-totals";

const { requireRoleMock, insertSalesOrderMock, insertSalesOrderLinesMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  insertSalesOrderMock: vi.fn(),
  insertSalesOrderLinesMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/sales-orders/infrastructure/sales-order.repository", () => ({
  insertSalesOrder: insertSalesOrderMock,
  insertSalesOrderLines: insertSalesOrderLinesMock,
}));

const { registerSale } = await import("@/features/sales-orders/application/register-sale");

const VALID_INPUT = {
  channel: "own" as const,
  paymentMethod: "cash" as const,
  lines: [
    { itemType: "flavor" as const, itemId: "flavor-1", quantity: 2, unitPrice: "2500.00" },
    { itemType: "pack" as const, itemId: "pack-1", quantity: 1, unitPrice: "25000.00" },
  ],
};

/**
 * `registerSale` is the FIRST use-case in this project where a mutating
 * action must allow BOTH admin and colaborador (spec permission table:
 * "Register sales: Yes" for both roles) — the key assertion below is that
 * it calls `requireRole(["admin", "colaborador"])`, not `["admin"]` alone.
 */
describe("registerSale (admin + colaborador allowed)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertSalesOrderMock.mockReset();
    insertSalesOrderLinesMock.mockReset();
  });

  it("denies an unauthenticated/unauthorized caller and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(registerSale(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertSalesOrderMock).not.toHaveBeenCalled();
    expect(insertSalesOrderLinesMock).not.toHaveBeenCalled();
  });

  it("allows a colaborador and persists the order with its computed total", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "colaborador" } });
    insertSalesOrderMock.mockResolvedValueOnce({
      id: "order-1",
      channel: "own",
      paymentMethod: "cash",
      totalAmount: "30000.00",
      soldAt: new Date("2026-08-18T12:00:00Z"),
    });
    insertSalesOrderLinesMock.mockResolvedValueOnce([]);

    const resultado = await registerSale(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin", "colaborador"]);
    expect(insertSalesOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "own", paymentMethod: "cash", totalAmount: "30000" }),
    );
    expect(resultado.order.id).toBe("order-1");
  });

  it("allows an admin and snapshots each line's resolved unit price and line total", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    insertSalesOrderMock.mockResolvedValueOnce({ id: "order-2" });
    insertSalesOrderLinesMock.mockResolvedValueOnce([]);

    await registerSale(VALID_INPUT);

    expect(insertSalesOrderLinesMock).toHaveBeenCalledWith([
      expect.objectContaining({
        salesOrderId: "order-2",
        itemType: "flavor",
        itemId: "flavor-1",
        quantity: 2,
        unitPriceSnapshot: "2500",
        lineTotal: "5000",
      }),
      expect.objectContaining({
        salesOrderId: "order-2",
        itemType: "pack",
        itemId: "pack-1",
        quantity: 1,
        unitPriceSnapshot: "25000",
        lineTotal: "25000",
      }),
    ]);
  });

  it("rejects a sale with no lines before ever calling the repository (domain validation)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });

    await expect(
      registerSale({ channel: "own", paymentMethod: "cash", lines: [] }),
    ).rejects.toThrow(SaleValidationError);

    expect(insertSalesOrderMock).not.toHaveBeenCalled();
  });
});
