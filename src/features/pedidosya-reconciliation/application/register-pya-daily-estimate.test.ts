import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";
import {
  PyaEstimateValidationError,
  PyaProfileNotConfiguredError,
} from "@/features/pedidosya-reconciliation/domain/compute-pya-estimate";
import { PricingParamsError } from "@/features/pricing/domain/calculator";

const { requireRoleMock, insertPyaDailyEstimateMock, listPricingProfileVersionsMock } = vi.hoisted(
  () => ({
    requireRoleMock: vi.fn(),
    insertPyaDailyEstimateMock: vi.fn(),
    listPricingProfileVersionsMock: vi.fn(),
  }),
);

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository", () => ({
  insertPyaDailyEstimate: insertPyaDailyEstimateMock,
}));

vi.mock("@/features/pricing/infrastructure/pricing-profile.repository", () => ({
  listPricingProfileVersions: listPricingProfileVersionsMock,
}));

const { registerPyaDailyEstimate } =
  await import("@/features/pedidosya-reconciliation/application/register-pya-daily-estimate");

/**
 * Golden profile matches the confirmed ~30.83% figure from
 * sdd/rincon-empanadero-management-app/pricing-formula-confirmed.
 */
const PEDIDOSYA_PROFILE = {
  channel: "pedidosya" as const,
  effectiveFrom: new Date("2026-01-01T00:00:00Z"),
  decomisoPct: "0.10",
  gananciaDeseadaPct: "0.40",
  comisionPlataformaPct: "0.23",
  ivaComisionPct: "0.21",
  comisionTarjetasPct: "0.03",
};

const VALID_INPUT = {
  orderNumber: "PYA-1",
  grossAmount: "10000",
  paymentMethod: "paid_in_app" as const,
  orderDate: new Date("2026-08-16T00:00:00Z"),
};

describe("registerPyaDailyEstimate (admin and colaborador server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    insertPyaDailyEstimateMock.mockReset();
    listPricingProfileVersionsMock.mockReset();
  });

  it("denies an unauthenticated caller and never touches the repository", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(registerPyaDailyEstimate(VALID_INPUT)).rejects.toThrow(UnauthorizedError);

    expect(insertPyaDailyEstimateMock).not.toHaveBeenCalled();
  });

  it("allows a colaborador (day-to-day entry, matches registerSale/registerPurchase's boundary)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "colaborador" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([PEDIDOSYA_PROFILE]);
    insertPyaDailyEstimateMock.mockResolvedValueOnce({ id: "estimate-1" });

    const resultado = await registerPyaDailyEstimate(VALID_INPUT);

    expect(requireRoleMock).toHaveBeenCalledWith(["admin", "colaborador"]);
    expect(listPricingProfileVersionsMock).toHaveBeenCalledWith("pedidosya");
    expect(resultado.id).toBe("estimate-1");
  });

  it("resolves the active pedidosya profile and computes the two distinct figures for an app-paid order", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([PEDIDOSYA_PROFILE]);
    insertPyaDailyEstimateMock.mockResolvedValueOnce({ id: "estimate-2" });

    await registerPyaDailyEstimate(VALID_INPUT);

    expect(insertPyaDailyEstimateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: "PYA-1",
        grossAmount: "10000",
        paymentMethod: "paid_in_app",
        comisionTotalUsed: "0.3083",
        cashInTillToday: "0",
        estimatedNetKept: "6917",
      }),
    );
  });

  it("computes cashInTillToday as the full gross for a cash-collected-by-store order (triangulation)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([PEDIDOSYA_PROFILE]);
    insertPyaDailyEstimateMock.mockResolvedValueOnce({ id: "estimate-3" });

    await registerPyaDailyEstimate({ ...VALID_INPUT, paymentMethod: "cash_collected_by_store" });

    expect(insertPyaDailyEstimateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cashInTillToday: "10000", estimatedNetKept: "6917" }),
    );
  });

  it("throws PyaProfileNotConfiguredError when no pedidosya profile exists yet", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([]);

    await expect(registerPyaDailyEstimate(VALID_INPUT)).rejects.toThrow(
      PyaProfileNotConfiguredError,
    );
    expect(insertPyaDailyEstimateMock).not.toHaveBeenCalled();
  });

  it("propagates domain validation errors before ever calling the repository", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([PEDIDOSYA_PROFILE]);

    await expect(registerPyaDailyEstimate({ ...VALID_INPUT, grossAmount: "0" })).rejects.toThrow(
      PyaEstimateValidationError,
    );
    expect(insertPyaDailyEstimateMock).not.toHaveBeenCalled();
  });

  it("propagates a PricingParamsError if the active profile's commission is misconfigured", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([
      { ...PEDIDOSYA_PROFILE, comisionPlataformaPct: "0.90", comisionTarjetasPct: "0.20" },
    ]);

    await expect(registerPyaDailyEstimate(VALID_INPUT)).rejects.toThrow(PricingParamsError);
    expect(insertPyaDailyEstimateMock).not.toHaveBeenCalled();
  });

  it("defaults orderDate to today when omitted", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    listPricingProfileVersionsMock.mockResolvedValueOnce([PEDIDOSYA_PROFILE]);
    insertPyaDailyEstimateMock.mockResolvedValueOnce({ id: "estimate-4" });

    const before = Date.now();
    await registerPyaDailyEstimate({
      orderNumber: "PYA-2",
      grossAmount: "1000",
      paymentMethod: "paid_in_app",
    });
    const after = Date.now();

    const callArg = insertPyaDailyEstimateMock.mock.calls[0][0];
    expect(callArg.orderDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(callArg.orderDate.getTime()).toBeLessThanOrEqual(after);
  });
});
