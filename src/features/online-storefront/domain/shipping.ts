import Decimal from "decimal.js";

/**
 * Pure shipping-cost domain (spec capability "online-storefront",
 * requirement "Cart, discounts, shipping, fulfillment, checkout"). No
 * DB/date/env/framework imports — mirrors the isolation pattern of
 * `domain/discount.ts` and `sales-orders/domain/compute-sale-totals.ts`.
 *
 * PRAGMATIC MVP CHOICE (documented, same spirit as `discount.ts`'s gap
 * note): shipping cost is admin-configured via a POSTAL-CODE-PREFIX table
 * (`postalCodePrefix` → flat `rate`), not a single flat rate — Argentine
 * postal codes cluster by leading digits, so a prefix table lets the owner
 * price nearby vs. far delivery zones differently without per-postal-code
 * rows. A single "0"-or-empty-prefix row also works as a catch-all flat
 * rate if the owner only ever wants one price. The OWNER MUST review the
 * actual configured rates/zones before going live — this batch only builds
 * the mechanism, same MVP-gap discipline `discount.ts` already established.
 */
export type FulfillmentMethod = "pickup" | "delivery";

export interface ShippingRateRecord {
  postalCodePrefix: string;
  rate: Decimal.Value;
}

export class ShippingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingValidationError";
  }
}

/**
 * Pickup never incurs a shipping cost (spec "Delivery-or-pickup fulfillment
 * choice") — postal code and rates are ignored entirely for pickup. Delivery
 * requires a postal code and resolves the cost from the MOST SPECIFIC
 * (longest) matching prefix in `rates`, so a narrow zone rate overrides a
 * broader fallback one. Throws `ShippingValidationError` for a missing
 * postal code or an unconfigured zone — a caller (checkout) must surface
 * this to the customer rather than silently guessing a price.
 */
export function resolveShippingCost(
  fulfillment: FulfillmentMethod,
  postalCode: string | undefined,
  rates: ShippingRateRecord[],
): Decimal {
  if (fulfillment === "pickup") {
    return new Decimal(0);
  }

  if (!postalCode) {
    throw new ShippingValidationError("A postal code is required for delivery.");
  }

  const matches = rates.filter((rate) => postalCode.startsWith(rate.postalCodePrefix));

  if (matches.length === 0) {
    throw new ShippingValidationError(
      `No shipping rate configured for postal code "${postalCode}".`,
    );
  }

  const longestMatch = matches.reduce((best, candidate) =>
    candidate.postalCodePrefix.length > best.postalCodePrefix.length ? candidate : best,
  );

  return new Decimal(longestMatch.rate);
}
