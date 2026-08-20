import Decimal from "decimal.js";

/**
 * Pure domain logic for the purchase-expense-log capability — no DB/date/
 * env/framework imports (mirrors `sales-orders/domain/compute-sale-totals.ts`'s
 * isolation pattern).
 *
 * This is a REGISTRATION LOG ONLY (mvp-decisions #10 / spec "No
 * quantity-based stock tracking (non-goal)"): `quantity`/`unitPrice` are
 * recorded for a future stock module to derive movements from later, but
 * this function does NOT track running stock levels and NEVER auto-deducts
 * inventory on sale — it only computes one purchase line's total cost.
 */
export interface PurchaseTotalInput {
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
}

export interface PurchaseTotal {
  quantity: Decimal;
  unitPrice: Decimal;
  totalCost: Decimal;
}

export class PurchaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseValidationError";
  }
}

export function computePurchaseTotal(input: PurchaseTotalInput): PurchaseTotal {
  const quantity = new Decimal(input.quantity);
  const unitPrice = new Decimal(input.unitPrice);

  if (quantity.isNegative() || quantity.isZero()) {
    throw new PurchaseValidationError("Purchase quantity must be greater than zero.");
  }

  if (unitPrice.isNegative()) {
    throw new PurchaseValidationError("Purchase unit price must not be negative.");
  }

  return { quantity, unitPrice, totalCost: quantity.times(unitPrice) };
}
