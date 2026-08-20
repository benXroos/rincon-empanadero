import Decimal from "decimal.js";

/**
 * Pure discount-code calculator (spec capability "online-storefront",
 * requirement "Cart, discounts, shipping, fulfillment, checkout"). No
 * DB/date/env/framework imports — mirrors the isolation pattern of
 * `pricing/domain/calculator.ts` and `sales-orders/domain/compute-sale-totals.ts`.
 *
 * MVP GAP NOTE (flagged, not silently resolved): the owner's old Empretienda
 * site had discount codes, but the exact rules (single-use? expiry?) were
 * never captured. This implements the simplest admin-configurable model that
 * satisfies the spec: a code is `percentage` or `fixed_amount`, has a
 * `value`, and an `active` boolean — no expiry/usage-limit logic. The owner
 * must review the actual discount VALUES before going live; the MECHANISM
 * here is intentionally simple and swappable.
 */
export type DiscountType = "percentage" | "fixed_amount";

export interface DiscountCodeRecord {
  code: string;
  type: DiscountType;
  value: Decimal.Value;
  active: boolean;
}

export class DiscountValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscountValidationError";
  }
}

/**
 * Returns `subtotal` unchanged when `discount` is undefined (no code was
 * applied). Throws `DiscountValidationError` for an inactive code — an
 * inactive/unknown code is a rejection, not a silent no-op, so the caller
 * (the checkout application layer) can surface it to the customer. Never
 * discounts below zero.
 */
export function applyDiscountCode(
  subtotal: Decimal.Value,
  discount: DiscountCodeRecord | undefined,
): Decimal {
  const subtotalDecimal = new Decimal(subtotal);

  if (!discount) {
    return subtotalDecimal;
  }

  if (!discount.active) {
    throw new DiscountValidationError(`Discount code "${discount.code}" is not active.`);
  }

  const discounted =
    discount.type === "percentage"
      ? subtotalDecimal.times(new Decimal(1).minus(new Decimal(discount.value).dividedBy(100)))
      : subtotalDecimal.minus(new Decimal(discount.value));

  return Decimal.max(discounted, 0);
}
