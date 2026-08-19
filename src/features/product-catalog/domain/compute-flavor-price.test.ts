import { describe, expect, it } from "vitest";
import { computeFlavorPrice } from "@/features/product-catalog/domain/compute-flavor-price";

/**
 * Reuses the Phase 2 pricing calculator (design's "Pricing Calculator
 * Isolation") to price a flavor for a given channel's active profile,
 * rounding ONLY at this storage/display boundary (design decision #6).
 * Same golden fixture as `pricing/domain/calculator.test.ts` so both
 * features stay provably consistent.
 */
describe("computeFlavorPrice", () => {
  it("computes the golden-case rounded price for a flavor's cost and profile", () => {
    const price = computeFlavorPrice("1003.4096", {
      decomisoPct: "0.10",
      gananciaDeseadaPct: "0.40",
      comisionPlataformaPct: "0.23",
      ivaComisionPct: "0.21",
      comisionTarjetasPct: "0.03",
    });

    expect(price.toFixed(2)).toBe("2256.56");
  });

  it("returns a different rounded price when the flavor's cost differs", () => {
    const price = computeFlavorPrice("500", {
      decomisoPct: "0.10",
      gananciaDeseadaPct: "0.40",
      comisionPlataformaPct: "0.23",
      ivaComisionPct: "0.21",
      comisionTarjetasPct: "0.03",
    });

    expect(price.toFixed(2)).toBe("1124.44");
  });
});
