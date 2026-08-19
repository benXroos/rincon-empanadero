import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calcularPrecio,
  redondearPrecio,
  PricingParamsError,
} from "@/features/pricing/domain/calculator";

/**
 * Golden fixture from the owner's own spreadsheet (Parámetros tab), confirmed
 * cell-by-cell — see sdd/rincon-empanadero-management-app/pricing-formula-confirmed.
 * costo_materiales is the FULL-PRECISION value (1003.4096), not the
 * display-rounded 1003.4 — using the rounded value does not reproduce the
 * recorded precio_sugerido.
 */
const GOLDEN_PARAMS = {
  decomisoPct: "0.10",
  gananciaDeseadaPct: "0.40",
  comisionPlataformaPct: "0.23",
  ivaComisionPct: "0.21",
  comisionTarjetasPct: "0.03",
};

describe("calcularPrecio", () => {
  it("reproduces the owner's golden spreadsheet fixture exactly", () => {
    const resultado = calcularPrecio("1003.4096", GOLDEN_PARAMS);

    expect(resultado.costoReal.toDecimalPlaces(4).toString()).toBe("1114.8996");
    expect(redondearPrecio(resultado.precioSugerido).toString()).toBe("2256.56");
  });

  /**
   * CRITICAL semantic guard: `gananciaDeseadaPct` MUST be applied as a markup
   * on cost (`costoReal * (1 + g)`), NOT as a gross-margin-of-price divisor
   * (`costoReal / (1 - g)`). These are mathematically different formulas.
   * If a future refactor swaps the markup for the divisor form, THIS test
   * must fail — it asserts the markup result and explicitly rejects the
   * gross-margin result using the same golden inputs.
   */
  it("applies ganancia_deseada as a markup on cost, NOT a gross-margin-of-price divisor", () => {
    const resultado = calcularPrecio("1003.4096", GOLDEN_PARAMS);
    const precioRedondeado = redondearPrecio(resultado.precioSugerido).toString();

    // Markup form (correct, per the confirmed business rule):
    //   precio = costoReal * (1 + g) / (1 - comisionTotal)
    expect(precioRedondeado).toBe("2256.56");

    // Gross-margin form (WRONG — must NOT be produced):
    //   precio = costoReal / (1 - g) / (1 - comisionTotal)
    const gananciaComoDivisor = resultado.costoReal
      .div(new Decimal(1).minus(GOLDEN_PARAMS.gananciaDeseadaPct))
      .div(new Decimal(1).minus(resultado.comisionTotal));
    const precioSiFueraDivisor = redondearPrecio(gananciaComoDivisor).toString();

    expect(precioSiFueraDivisor).toBe("2686.38");
    expect(precioRedondeado).not.toBe(precioSiFueraDivisor);
  });

  it("computes comisionTotal as comisionPlataforma * (1 + ivaComision) + comisionTarjetas", () => {
    const resultado = calcularPrecio("1003.4096", GOLDEN_PARAMS);

    expect(resultado.comisionTotal.toString()).toBe("0.3083");
  });

  it("computes independent prices per sales channel from the same cost", () => {
    const costoMateriales = "1003.4096";

    const ownChannelParams = GOLDEN_PARAMS;
    const pedidosYaParams = {
      decomisoPct: "0.10",
      gananciaDeseadaPct: "0.40",
      comisionPlataformaPct: "0.30",
      ivaComisionPct: "0.21",
      comisionTarjetasPct: "0.00",
    };

    const ownResult = calcularPrecio(costoMateriales, ownChannelParams);
    const pedidosYaResult = calcularPrecio(costoMateriales, pedidosYaParams);

    // Same cost input, but each channel's own commission profile yields a
    // different suggested price — proves the calculator does not hardcode
    // one channel's commission structure.
    expect(redondearPrecio(ownResult.precioSugerido).toString()).toBe("2256.56");
    expect(redondearPrecio(pedidosYaResult.precioSugerido).toString()).not.toBe(
      redondearPrecio(ownResult.precioSugerido).toString(),
    );
    expect(redondearPrecio(pedidosYaResult.precioSugerido).toString()).toBe("2450.33");
  });

  it("rejects a decomiso percentage of 100% or more", () => {
    expect(() => calcularPrecio("1000", { ...GOLDEN_PARAMS, decomisoPct: "1" })).toThrow(
      PricingParamsError,
    );
  });

  it("rejects a comisionTotal of 100% or more", () => {
    expect(() =>
      calcularPrecio("1000", {
        ...GOLDEN_PARAMS,
        comisionPlataformaPct: "0.90",
        ivaComisionPct: "0.21",
        comisionTarjetasPct: "0.10",
      }),
    ).toThrow(PricingParamsError);
  });
});
