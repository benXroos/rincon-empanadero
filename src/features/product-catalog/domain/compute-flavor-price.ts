import type Decimal from "decimal.js";
import { calcularPrecio, redondearPrecio } from "@/features/pricing/domain/calculator";
import type { PricingProfileParams } from "@/features/pricing/domain/calculator";

/**
 * Thin domain composition: prices a flavor for one channel by feeding its
 * `costoMateriales` through the Phase 2 pricing calculator, then rounding
 * ONLY at this storage/display boundary (design decision #6). This is the
 * value `price_list_item.price` caches per (flavor, channel).
 */
export function computeFlavorPrice(
  costoMateriales: Decimal.Value,
  profile: PricingProfileParams,
): Decimal {
  const { precioSugerido } = calcularPrecio(costoMateriales, profile);
  return redondearPrecio(precioSugerido);
}
