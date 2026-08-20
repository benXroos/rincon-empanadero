import { describe, expect, it } from "vitest";
import { resolveShippingCost, ShippingValidationError } from "@/features/online-storefront/domain/shipping";

/**
 * Spec capability "online-storefront", requirement "Cart, discounts,
 * shipping, fulfillment, checkout": pickup never incurs a shipping cost;
 * delivery resolves a cost from an admin-configured postal-code-prefix
 * table, picking the MOST SPECIFIC (longest) matching prefix so a narrower
 * rate overrides a broader fallback one.
 */
describe("resolveShippingCost", () => {
  it("returns zero for pickup, ignoring postal code and rates entirely", () => {
    const result = resolveShippingCost("pickup", undefined, []);

    expect(result.toString()).toBe("0");
  });

  it("throws when delivery is chosen without a postal code", () => {
    expect(() => resolveShippingCost("delivery", undefined, [])).toThrow(ShippingValidationError);
  });

  it("throws when no configured rate's prefix matches the postal code", () => {
    const rates = [{ postalCodePrefix: "5000", rate: "1000.00" }];

    expect(() => resolveShippingCost("delivery", "1900", rates)).toThrow(ShippingValidationError);
  });

  it("resolves the matching rate for an exact-prefix postal code", () => {
    const rates = [{ postalCodePrefix: "1900", rate: "1500.00" }];

    const result = resolveShippingCost("delivery", "1900", rates);

    expect(result.toString()).toBe("1500");
  });

  it("picks the longest (most specific) matching prefix over a broader fallback", () => {
    const rates = [
      { postalCodePrefix: "1", rate: "2000.00" },
      { postalCodePrefix: "1900", rate: "1200.00" },
    ];

    const result = resolveShippingCost("delivery", "1900", rates);

    expect(result.toString()).toBe("1200");
  });
});
