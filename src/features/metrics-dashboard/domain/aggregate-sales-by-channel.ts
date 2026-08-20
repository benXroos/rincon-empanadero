import Decimal from "decimal.js";

/**
 * Pure domain logic for the metrics-dashboard capability (spec "Sales
 * metrics by channel and date range") — no DB/date/env/framework imports.
 * Mirrors every other domain module's isolation discipline in this project
 * (see e.g. `compute-pya-estimate.ts`).
 *
 * Groups an already-fetched, mixed-channel `listSalesOrdersInRange(start,
 * end)` result into per-channel totals. Takes ONE query result and splits
 * it here rather than issuing a separate repository call per channel — the
 * `channel` column already carries the split (see
 * `sales-order.repository.ts`'s own doc comment on `listSalesOrdersInRange`).
 *
 * `SalesChannel` is defined locally (not imported from `schema.ts`) to keep
 * this module free of any DB/framework dependency, same as
 * `compute-pya-estimate.ts`'s locally-defined `PyaPaymentMethod`.
 */
export type SalesChannel = "own" | "pedidosya";

export interface SalesOrderForAggregation {
  channel: SalesChannel;
  totalAmount: Decimal.Value;
}

export interface ChannelSalesTotals {
  orderCount: number;
  totalAmount: Decimal;
}

export type SalesByChannel = Record<SalesChannel, ChannelSalesTotals>;

const CHANNELS: SalesChannel[] = ["own", "pedidosya"];

export function aggregateSalesByChannel(orders: SalesOrderForAggregation[]): SalesByChannel {
  const totals = Object.fromEntries(
    CHANNELS.map((channel) => [channel, { orderCount: 0, totalAmount: new Decimal(0) }]),
  ) as SalesByChannel;

  for (const order of orders) {
    const bucket = totals[order.channel];
    bucket.orderCount += 1;
    bucket.totalAmount = bucket.totalAmount.plus(order.totalAmount);
  }

  return totals;
}
