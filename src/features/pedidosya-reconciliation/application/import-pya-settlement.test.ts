import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnauthorizedError } from "@/core/auth/require-role";
import { SettlementParseError } from "@/features/pedidosya-reconciliation/infrastructure/parse-settlement-workbook";

const {
  requireRoleMock,
  parseSettlementWorkbookMock,
  findPyaDailyEstimateByOrderNumberMock,
  listPyaDailyEstimatesInRangeMock,
  insertPyaSettlementLineMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  parseSettlementWorkbookMock: vi.fn(),
  findPyaDailyEstimateByOrderNumberMock: vi.fn(),
  listPyaDailyEstimatesInRangeMock: vi.fn(),
  insertPyaSettlementLineMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/features/pedidosya-reconciliation/infrastructure/parse-settlement-workbook", () => ({
  parseSettlementWorkbook: parseSettlementWorkbookMock,
  SettlementParseError: class SettlementParseError extends Error {},
}));

vi.mock("@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository", () => ({
  findPyaDailyEstimateByOrderNumber: findPyaDailyEstimateByOrderNumberMock,
  listPyaDailyEstimatesInRange: listPyaDailyEstimatesInRangeMock,
}));

vi.mock(
  "@/features/pedidosya-reconciliation/infrastructure/pya-settlement-line.repository",
  () => ({
    insertPyaSettlementLine: insertPyaSettlementLineMock,
  }),
);

const { importPyaSettlement } =
  await import("@/features/pedidosya-reconciliation/application/import-pya-settlement");

const PARSED_ROW_MATCHED = {
  orderNumber: "PYA-1",
  orderDate: new Date("2026-08-16T00:00:00Z"),
  grossAmount: { toString: () => "45000" },
  netSaleAmount: { toString: () => "45000" },
  serviceFeeAmount: { toString: () => "10350" },
};

const PARSED_ROW_NO_ESTIMATE = {
  orderNumber: "PYA-2",
  orderDate: new Date("2026-08-17T00:00:00Z"),
  grossAmount: { toString: () => "1000" },
  netSaleAmount: { toString: () => "1000" },
  serviceFeeAmount: { toString: () => "230" },
};

describe("importPyaSettlement (admin-only server action)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    parseSettlementWorkbookMock.mockReset();
    findPyaDailyEstimateByOrderNumberMock.mockReset();
    listPyaDailyEstimatesInRangeMock.mockReset();
    insertPyaSettlementLineMock.mockReset();
    listPyaDailyEstimatesInRangeMock.mockResolvedValue([]);
  });

  it("denies a non-admin caller and never parses or persists anything", async () => {
    requireRoleMock.mockRejectedValueOnce(new UnauthorizedError());

    await expect(importPyaSettlement(Buffer.from(""))).rejects.toThrow(UnauthorizedError);

    expect(parseSettlementWorkbookMock).not.toHaveBeenCalled();
    expect(insertPyaSettlementLineMock).not.toHaveBeenCalled();
  });

  it("requires admin specifically (import is more sensitive than daily entry)", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    parseSettlementWorkbookMock.mockReturnValueOnce([]);

    await importPyaSettlement(Buffer.from(""));

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
  });

  it("matches a settlement row to its Stage 1 estimate and inserts a 'mismatch' or 'matched' line", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    parseSettlementWorkbookMock.mockReturnValueOnce([PARSED_ROW_MATCHED]);
    findPyaDailyEstimateByOrderNumberMock.mockResolvedValueOnce({
      id: "estimate-1",
      estimatedNetKept: "31126.5",
    });
    insertPyaSettlementLineMock.mockResolvedValueOnce({
      id: "line-1",
      orderNumber: "PYA-1",
      varianceStatus: "mismatch",
    });

    const report = await importPyaSettlement(Buffer.from(""));

    expect(findPyaDailyEstimateByOrderNumberMock).toHaveBeenCalledWith("PYA-1");
    expect(insertPyaSettlementLineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: "PYA-1",
        matchedEstimateId: "estimate-1",
        varianceStatus: "mismatch",
      }),
    );
    expect(report.totalRows).toBe(1);
    expect(report.mismatchCount).toBe(1);
    expect(report.matchedCount).toBe(0);
    expect(report.noEstimateFoundCount).toBe(0);
  });

  it("flags 'no_estimate_found' for a settlement row with no Stage 1 match, matchedEstimateId is null", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    parseSettlementWorkbookMock.mockReturnValueOnce([PARSED_ROW_NO_ESTIMATE]);
    findPyaDailyEstimateByOrderNumberMock.mockResolvedValueOnce(undefined);
    insertPyaSettlementLineMock.mockResolvedValueOnce({
      id: "line-2",
      orderNumber: "PYA-2",
      varianceStatus: "no_estimate_found",
    });

    const report = await importPyaSettlement(Buffer.from(""));

    expect(insertPyaSettlementLineMock).toHaveBeenCalledWith(
      expect.objectContaining({ matchedEstimateId: null, varianceStatus: "no_estimate_found" }),
    );
    expect(report.noEstimateFoundCount).toBe(1);
  });

  it("flags estimates that exist in range but have no matching settlement row in this import batch", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    parseSettlementWorkbookMock.mockReturnValueOnce([PARSED_ROW_MATCHED]);
    findPyaDailyEstimateByOrderNumberMock.mockResolvedValueOnce({
      id: "estimate-1",
      estimatedNetKept: "31126.5",
    });
    insertPyaSettlementLineMock.mockResolvedValueOnce({ id: "line-1", orderNumber: "PYA-1" });
    listPyaDailyEstimatesInRangeMock.mockResolvedValueOnce([
      { id: "estimate-1", orderNumber: "PYA-1" },
      { id: "estimate-orphan", orderNumber: "PYA-ORPHAN" },
    ]);

    const report = await importPyaSettlement(Buffer.from(""));

    expect(report.estimatesWithoutSettlementRow).toEqual(["PYA-ORPHAN"]);
  });

  it("returns a zeroed report for an empty parsed file without touching the repository", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    parseSettlementWorkbookMock.mockReturnValueOnce([]);

    const report = await importPyaSettlement(Buffer.from(""));

    expect(report.totalRows).toBe(0);
    expect(insertPyaSettlementLineMock).not.toHaveBeenCalled();
  });

  it("propagates a SettlementParseError before ever calling requireRole's downstream repositories", async () => {
    requireRoleMock.mockResolvedValueOnce({ user: { role: "admin" } });
    parseSettlementWorkbookMock.mockImplementationOnce(() => {
      throw new SettlementParseError("Expected sheet not found");
    });

    await expect(importPyaSettlement(Buffer.from(""))).rejects.toThrow(SettlementParseError);
    expect(insertPyaSettlementLineMock).not.toHaveBeenCalled();
  });
});
