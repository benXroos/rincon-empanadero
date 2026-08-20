import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  listSalesOrdersInRangeMock,
  listPyaDailyEstimatesInRangeMock,
  listPyaSettlementLinesInRangeMock,
} = vi.hoisted(() => ({
  listSalesOrdersInRangeMock: vi.fn(),
  listPyaDailyEstimatesInRangeMock: vi.fn(),
  listPyaSettlementLinesInRangeMock: vi.fn(),
}));

vi.mock("@/features/sales-orders/infrastructure/sales-order.repository", () => ({
  listSalesOrdersInRange: listSalesOrdersInRangeMock,
}));

vi.mock("@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository", () => ({
  listPyaDailyEstimatesInRange: listPyaDailyEstimatesInRangeMock,
}));

vi.mock(
  "@/features/pedidosya-reconciliation/infrastructure/pya-settlement-line.repository",
  () => ({
    listPyaSettlementLinesInRange: listPyaSettlementLinesInRangeMock,
  }),
);

const { getDashboardMetrics } =
  await import("@/features/metrics-dashboard/application/get-dashboard-metrics");

const START = new Date("2026-08-01T00:00:00Z");
const END = new Date("2026-08-31T23:59:59Z");

describe("getDashboardMetrics", () => {
  beforeEach(() => {
    listSalesOrdersInRangeMock.mockReset();
    listPyaDailyEstimatesInRangeMock.mockReset();
    listPyaSettlementLinesInRangeMock.mockReset();
  });

  it("queries all three range sources ONCE each and composes their pure aggregations", async () => {
    listSalesOrdersInRangeMock.mockResolvedValueOnce([
      { channel: "own", totalAmount: "10000" },
      { channel: "pedidosya", totalAmount: "5000" },
    ]);
    listPyaDailyEstimatesInRangeMock.mockResolvedValueOnce([
      { orderNumber: "PYA-1", estimatedNetKept: "3462" },
    ]);
    listPyaSettlementLinesInRangeMock.mockResolvedValueOnce([
      {
        orderNumber: "PYA-1",
        netSaleAmount: "5000",
        serviceFeeAmount: "1150",
        varianceStatus: "matched",
        varianceAmount: "0",
      },
    ]);

    const resultado = await getDashboardMetrics(START, END);

    expect(listSalesOrdersInRangeMock).toHaveBeenCalledTimes(1);
    expect(listSalesOrdersInRangeMock).toHaveBeenCalledWith(START, END);
    expect(listPyaDailyEstimatesInRangeMock).toHaveBeenCalledWith(START, END);
    expect(listPyaSettlementLinesInRangeMock).toHaveBeenCalledWith(START, END);

    expect(resultado.range).toEqual({ start: START, end: END });
    expect(resultado.salesByChannel.own.totalAmount.toString()).toBe("10000");
    expect(resultado.salesByChannel.pedidosya.totalAmount.toString()).toBe("5000");
    expect(resultado.pyaVariance.totalActualNetKept.toString()).toBe("3850");
  });

  it("composes an all-zero summary when no records exist in the range (triangulation)", async () => {
    listSalesOrdersInRangeMock.mockResolvedValueOnce([]);
    listPyaDailyEstimatesInRangeMock.mockResolvedValueOnce([]);
    listPyaSettlementLinesInRangeMock.mockResolvedValueOnce([]);

    const resultado = await getDashboardMetrics(START, END);

    expect(resultado.salesByChannel.own.orderCount).toBe(0);
    expect(resultado.salesByChannel.pedidosya.orderCount).toBe(0);
    expect(resultado.pyaVariance.totalEstimatedNetKept.toString()).toBe("0");
    expect(resultado.pyaVariance.mismatchedOrders).toEqual([]);
  });
});
