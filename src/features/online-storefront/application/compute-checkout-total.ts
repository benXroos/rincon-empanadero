import type Decimal from "decimal.js";
import {
  computeCartTotal,
  type CartLineTotal,
} from "@/features/online-storefront/application/compute-cart-total";
import { listShippingRates } from "@/features/online-storefront/infrastructure/storefront.repository";
import {
  resolveShippingCost,
  type FulfillmentMethod,
} from "@/features/online-storefront/domain/shipping";
import type { Cart } from "@/features/online-storefront/domain/cart";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";

/**
 * Adds shipping cost on top of `computeCartTotal`'s already-resolved
 * per-line pricing and discount (spec "Cart, discounts, shipping,
 * fulfillment, checkout") — checkout MUST NOT re-resolve catalog prices
 * itself, per the orchestrator's explicit instruction for this batch, so
 * this function REUSES `computeCartTotal` rather than duplicating any of
 * its logic. Pickup adds no shipping cost; delivery resolves it via the
 * pure `domain/shipping.ts#resolveShippingCost` against the admin-configured
 * postal-code-prefix rates.
 */
export interface ComputeCheckoutTotalInput {
  cart: Cart;
  channel: SalesChannel;
  fulfillment: FulfillmentMethod;
  postalCode?: string;
  discountCode?: string;
}

export interface CheckoutTotal {
  lines: CartLineTotal[];
  subtotal: Decimal;
  discountedSubtotal: Decimal;
  shippingCost: Decimal;
  total: Decimal;
}

export async function computeCheckoutTotal(
  input: ComputeCheckoutTotalInput,
): Promise<CheckoutTotal> {
  const {
    lines,
    subtotal,
    total: discountedSubtotal,
  } = await computeCartTotal(input.cart, input.channel, input.discountCode);

  const rates = await listShippingRates();
  const shippingCost = resolveShippingCost(input.fulfillment, input.postalCode, rates);
  const total = discountedSubtotal.plus(shippingCost);

  return { lines, subtotal, discountedSubtotal, shippingCost, total };
}
