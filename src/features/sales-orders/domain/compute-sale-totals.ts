import Decimal from "decimal.js";

/**
 * Pure domain logic for the sales-orders capability — no DB/date/env/
 * framework imports (matching the pricing calculator's isolation pattern,
 * see `features/pricing/domain/calculator.ts`).
 *
 * A sale is a completed-sale record: channel, line items (each referencing
 * a product-catalog flavor or pack) with a PRICE-AT-TIME-OF-SALE snapshot,
 * quantity, order total, payment method, and a timestamp. There is no
 * pending/paid/fulfilled state machine — if a sale is being recorded, it
 * happened (MVP scope decision, resolving the ambiguity the proposal left
 * open about an order-state machine).
 *
 * `unitPrice` is ALWAYS an already-resolved price handed in by the caller
 * (looked up from `price_list_items`/`pack_price_list_items` for a manual
 * sale-entry action, or a discounted price from Phase 6's checkout) — this
 * function only computes totals from it and never re-derives it live. That
 * is what makes it a snapshot: once computed here, it is written to the DB
 * as-is and a later catalog re-price never rewrites it, mirroring design
 * decision #7 for `pricing_profile`.
 */
export interface SaleLineTotalInput {
  quantity: number;
  unitPrice: Decimal.Value;
}

export interface SaleLineTotal {
  quantity: number;
  unitPrice: Decimal;
  lineTotal: Decimal;
}

export interface SaleTotals {
  lines: SaleLineTotal[];
  orderTotal: Decimal;
}

export class SaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaleValidationError";
  }
}

export function computeSaleTotals(lines: SaleLineTotalInput[]): SaleTotals {
  if (lines.length === 0) {
    throw new SaleValidationError("A sale must have at least one line item.");
  }

  const computedLines = lines.map((line) => {
    if (line.quantity <= 0) {
      throw new SaleValidationError("Each sale line must have a quantity greater than zero.");
    }

    const unitPrice = new Decimal(line.unitPrice);

    if (unitPrice.isNegative()) {
      throw new SaleValidationError("Each sale line's unit price must not be negative.");
    }

    return {
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice.times(line.quantity),
    };
  });

  const orderTotal = computedLines.reduce((sum, line) => sum.plus(line.lineTotal), new Decimal(0));

  return { lines: computedLines, orderTotal };
}
