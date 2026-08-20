import {
  aggregatePyaVariance,
  type PyaVarianceSummary,
} from "@/features/metrics-dashboard/domain/aggregate-pya-variance";
import {
  aggregateSalesByChannel,
  type SalesByChannel,
} from "@/features/metrics-dashboard/domain/aggregate-sales-by-channel";
import { listPyaDailyEstimatesInRange } from "@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository";
import { listPyaSettlementLinesInRange } from "@/features/pedidosya-reconciliation/infrastructure/pya-settlement-line.repository";
import { listSalesOrdersInRange } from "@/features/sales-orders/infrastructure/sales-order.repository";

/**
 * `getDashboardMetrics` — the metrics-dashboard capability's single
 * composed read (spec "Sales metrics by channel and date range" + "PedidosYa
 * cash-vs-settlement variance view"). Not a `"use server"` action — this is
 * a plain read called directly from the dashboard's async server-component
 * page, same calling convention as every other admin page calling its
 * capability's list query directly (e.g. `/admin/purchases` calling
 * `listPurchaseLogs()`).
 *
 * Issues exactly ONE range query per data source (never a separate query
 * per channel — `listSalesOrdersInRange` already returns every channel in
 * one result, split by the pure `aggregateSalesByChannel`), then hands the
 * raw rows to the pure domain aggregators. No variance is recomputed here —
 * `pya-settlement-line` rows already carry `varianceStatus`/`varianceAmount`
 * from Phase 9's import-time computation.
 *
 * Read-only, no role restriction beyond the shared `/admin` layout's
 * any-authenticated-session gate — matches this project's established
 * pattern for read paths (`/admin/purchases`, `/admin/pedidosya`, both
 * viewable by admin AND colaborador with no extra `requireRole` call).
 */
export interface DashboardMetrics {
  range: { start: Date; end: Date };
  salesByChannel: SalesByChannel;
  pyaVariance: PyaVarianceSummary;
}

export async function getDashboardMetrics(start: Date, end: Date): Promise<DashboardMetrics> {
  const [salesOrders, pyaEstimates, pyaSettlementLines] = await Promise.all([
    listSalesOrdersInRange(start, end),
    listPyaDailyEstimatesInRange(start, end),
    listPyaSettlementLinesInRange(start, end),
  ]);

  return {
    range: { start, end },
    salesByChannel: aggregateSalesByChannel(salesOrders),
    pyaVariance: aggregatePyaVariance(pyaEstimates, pyaSettlementLines),
  };
}
