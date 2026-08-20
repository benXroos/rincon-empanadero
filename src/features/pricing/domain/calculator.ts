import Decimal from "decimal.js";

/**
 * Pure pricing calculator — no DB, no date, no env, no framework imports.
 * See sdd/rincon-empanadero-management-app/design ("Pricing Calculator
 * Isolation") and sdd/rincon-empanadero-management-app/pricing-formula-confirmed.
 *
 * Formula chain:
 *   costoReal      = costoMateriales / (1 - decomisoPct)
 *   comisionTotal  = comisionPlataformaPct * (1 + ivaComisionPct) + comisionTarjetasPct
 *   precioSugerido = costoReal * (1 + gananciaDeseadaPct) / (1 - comisionTotal)
 *
 * `gananciaDeseadaPct` is a MARKUP ON COST (`costoReal * (1 + g)`), NOT a
 * gross-margin-of-price divisor (`costoReal / (1 - g)`). These two forms are
 * mathematically different; only the commission gross-up step uses the
 * `/(1-x)` divisor form. This distinction is load-bearing business logic.
 */
export interface PricingProfileParams {
  decomisoPct: Decimal.Value;
  gananciaDeseadaPct: Decimal.Value;
  comisionPlataformaPct: Decimal.Value;
  ivaComisionPct: Decimal.Value;
  comisionTarjetasPct: Decimal.Value;
}

export interface PrecioCalculado {
  costoReal: Decimal;
  comisionTotal: Decimal;
  precioSugerido: Decimal;
}

export class PricingParamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingParamsError";
  }
}

const ONE = new Decimal(1);

/**
 * Extracted out of `calcularPrecio` so any OTHER capability that needs the
 * SAME commission percentage (e.g. Phase 9's pedidosya-reconciliation daily
 * estimate) can resolve `comisionTotal` from a pricing profile without
 * duplicating this formula as a second hardcoded constant.
 */
export function calcularComisionTotal(
  params: Pick<
    PricingProfileParams,
    "comisionPlataformaPct" | "ivaComisionPct" | "comisionTarjetasPct"
  >,
): Decimal {
  const comisionPlataforma = new Decimal(params.comisionPlataformaPct);
  const ivaComision = new Decimal(params.ivaComisionPct);
  const comisionTarjetas = new Decimal(params.comisionTarjetasPct);

  const comisionTotal = comisionPlataforma.times(ivaComision.plus(ONE)).plus(comisionTarjetas);

  if (comisionTotal.gte(ONE)) {
    throw new PricingParamsError(
      "comisionTotal (comisionPlataforma * (1 + ivaComision) + comisionTarjetas) must be less than 1 (100%).",
    );
  }

  return comisionTotal;
}

export function calcularPrecio(
  costoMateriales: Decimal.Value,
  params: PricingProfileParams,
): PrecioCalculado {
  const costo = new Decimal(costoMateriales);
  const decomiso = new Decimal(params.decomisoPct);
  const ganancia = new Decimal(params.gananciaDeseadaPct);

  if (decomiso.gte(ONE)) {
    throw new PricingParamsError("decomisoPct must be less than 1 (100%).");
  }

  const comisionTotal = calcularComisionTotal(params);

  const costoReal = costo.div(ONE.minus(decomiso));
  const precioSugerido = costoReal.times(ganancia.plus(ONE)).div(ONE.minus(comisionTotal));

  return { costoReal, comisionTotal, precioSugerido };
}

/**
 * Rounds a Decimal to 2 decimal places, half-up — the ONLY place rounding
 * happens (design decision #6). Internal calculations stay full-precision;
 * this is applied only at the presentation/storage boundary.
 */
export function redondearPrecio(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
