"use server";

import type Decimal from "decimal.js";
import { requireRole } from "@/core/auth/require-role.server";
import { computeSaleTotals } from "@/features/sales-orders/domain/compute-sale-totals";
import {
  insertSalesOrder,
  insertSalesOrderLines,
} from "@/features/sales-orders/infrastructure/sales-order.repository";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";

/**
 * `registerSale` — the sales-orders capability's application entry point
 * (spec "Record orders per channel"). Per the access-control permission
 * table, "Register sales" is Yes for BOTH admin and colaborador — this is
 * the FIRST mutating use-case in this project that must allow colaborador,
 * so it calls `requireRole(["admin", "colaborador"])` instead of the
 * admin-only pattern every prior server action used.
 *
 * PHASE 6 (online-storefront) MUST call this exact function for checkout —
 * do not build a second order-creation path. Each `RegisterSaleLineInput`
 * carries an already-resolved `unitPrice` (from `price_list_items`/
 * `pack_price_list_items` for a plain sale, or a discounted price once
 * Phase 6 adds discount codes) — `registerSale` NEVER re-resolves a live
 * catalog price itself; it only snapshots whatever price it is given, via
 * the pure `computeSaleTotals` domain function, before requireRole's result
 * ever reaches the repository.
 */
export type SaleLineItemType = "flavor" | "pack";
export type SalePaymentMethod = "transfer" | "cash";

export interface RegisterSaleLineInput {
  itemType: SaleLineItemType;
  itemId: string;
  quantity: number;
  unitPrice: Decimal.Value;
}

export interface RegisterSaleInput {
  channel: SalesChannel;
  paymentMethod: SalePaymentMethod;
  lines: RegisterSaleLineInput[];
  /** Defaults to `new Date()` — a sale with no explicit timestamp happened now. */
  soldAt?: Date;
}

export async function registerSale(input: RegisterSaleInput) {
  await requireRole(["admin", "colaborador"]);

  const { lines: computedLines, orderTotal } = computeSaleTotals(input.lines);

  const order = await insertSalesOrder({
    channel: input.channel,
    paymentMethod: input.paymentMethod,
    totalAmount: orderTotal.toString(),
    soldAt: input.soldAt ?? new Date(),
  });

  const lines = await insertSalesOrderLines(
    computedLines.map((line, index) => ({
      salesOrderId: order.id,
      itemType: input.lines[index]!.itemType,
      itemId: input.lines[index]!.itemId,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
  );

  return { order, lines };
}
