import Decimal from "decimal.js";

/**
 * Pure domain logic for the waste/decomiso-by-flavor half of the
 * purchase-expense-log capability (mvp-decisions #10). Decomiso is logged
 * per empanada flavor — no quantity-based stock tracking, no automatic
 * per-sale deduction (explicit non-goal).
 */
export class DecomisoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecomisoValidationError";
  }
}

export function validateDecomisoQuantity(quantityWasted: Decimal.Value): Decimal {
  const quantity = new Decimal(quantityWasted);

  if (quantity.isNegative() || quantity.isZero()) {
    throw new DecomisoValidationError("Decomiso quantity wasted must be greater than zero.");
  }

  return quantity;
}
