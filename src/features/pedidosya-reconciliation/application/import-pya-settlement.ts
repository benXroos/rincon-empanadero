"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { computeSettlementVariance } from "@/features/pedidosya-reconciliation/domain/compute-settlement-variance";
import { parseSettlementWorkbook } from "@/features/pedidosya-reconciliation/infrastructure/parse-settlement-workbook";
import {
  findPyaDailyEstimateByOrderNumber,
  listPyaDailyEstimatesInRange,
} from "@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository";
import { insertPyaSettlementLine } from "@/features/pedidosya-reconciliation/infrastructure/pya-settlement-line.repository";
import type { PyaSettlementLine } from "@/infrastructure/db/schema";

/**
 * `importPyaSettlement` — Stage 2 of the pedidosya-reconciliation
 * capability (spec "Settlement variance calculation", refined by
 * pedidosya-reconciliation-design). Owner uploads the real PedidosYa
 * settlement Excel file (~2 weeks after the orders it covers); this
 * matches each real order back to its Stage 1 estimate by order number
 * and reports the variance.
 *
 * ADMIN-ONLY (`requireRole(["admin"])`) — deliberately stricter than Stage
 * 1's day-to-day `registerPyaDailyEstimate` boundary. This is a financial
 * reconciliation import, not routine data entry; mvp-decisions'
 * colaborador write scope (register sales/purchases/decomiso, mark
 * attendance, and now Stage 1 daily estimates) does not name this action,
 * and it is judged closer in sensitivity to pricing/cost configuration
 * (also admin-only) than to a routine registration log.
 */
export interface ImportPyaSettlementReport {
  totalRows: number;
  matchedCount: number;
  mismatchCount: number;
  noEstimateFoundCount: number;
  /** Order numbers with a Stage 1 estimate but no row in THIS import batch. */
  estimatesWithoutSettlementRow: string[];
  lines: PyaSettlementLine[];
}

export async function importPyaSettlement(
  fileBuffer: Buffer | ArrayBuffer,
): Promise<ImportPyaSettlementReport> {
  await requireRole(["admin"]);

  const rows = parseSettlementWorkbook(fileBuffer);

  if (rows.length === 0) {
    return {
      totalRows: 0,
      matchedCount: 0,
      mismatchCount: 0,
      noEstimateFoundCount: 0,
      estimatesWithoutSettlementRow: [],
      lines: [],
    };
  }

  const lines: PyaSettlementLine[] = [];

  for (const row of rows) {
    const estimate = await findPyaDailyEstimateByOrderNumber(row.orderNumber);
    const variance = computeSettlementVariance({
      estimatedNetKept: estimate?.estimatedNetKept,
      actualNetSaleAmount: row.netSaleAmount.toString(),
      actualServiceFeeAmount: row.serviceFeeAmount.toString(),
    });

    const inserted = await insertPyaSettlementLine({
      orderNumber: row.orderNumber,
      orderDate: row.orderDate,
      grossAmount: row.grossAmount.toString(),
      netSaleAmount: row.netSaleAmount.toString(),
      serviceFeeAmount: row.serviceFeeAmount.toString(),
      matchedEstimateId: estimate?.id ?? null,
      varianceStatus: variance.status,
      varianceAmount: variance.varianceAmount?.toString() ?? null,
    });

    lines.push(inserted);
  }

  const orderDatesMs = rows.map((row) => row.orderDate.getTime());
  const estimatesInRange = await listPyaDailyEstimatesInRange(
    new Date(Math.min(...orderDatesMs)),
    new Date(Math.max(...orderDatesMs)),
  );
  const settledOrderNumbers = new Set(rows.map((row) => row.orderNumber));
  const estimatesWithoutSettlementRow = estimatesInRange
    .filter((estimate) => !settledOrderNumbers.has(estimate.orderNumber))
    .map((estimate) => estimate.orderNumber);

  return {
    totalRows: rows.length,
    matchedCount: lines.filter((line) => line.varianceStatus === "matched").length,
    mismatchCount: lines.filter((line) => line.varianceStatus === "mismatch").length,
    noEstimateFoundCount: lines.filter((line) => line.varianceStatus === "no_estimate_found")
      .length,
    estimatesWithoutSettlementRow,
    lines,
  };
}
