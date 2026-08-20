import { describe, expect, it } from "vitest";
import { computePyaEstimate, PyaEstimateValidationError } from "./compute-pya-estimate";

/**
 * Uses the confirmed ~30.83% commission figure from
 * sdd/rincon-empanadero-management-app/pricing-formula-confirmed
 * (comisionPlataforma=23% * (1+IVA 21%) + comisionTarjetas 3%).
 */
const COMISION_TOTAL = "0.3083";

describe("computePyaEstimate", () => {
  it("app-paid order: nothing enters the till today, net kept is gross minus commission", () => {
    const resultado = computePyaEstimate({
      grossAmount: "10000",
      paymentMethod: "paid_in_app",
      comisionTotal: COMISION_TOTAL,
    });

    expect(resultado.cashInTillToday.toString()).toBe("0");
    expect(resultado.estimatedNetKept.toString()).toBe("6917");
  });

  it("cash-collected order: full gross enters the till today, but net kept STILL subtracts commission owed later", () => {
    const resultado = computePyaEstimate({
      grossAmount: "10000",
      paymentMethod: "cash_collected_by_store",
      comisionTotal: COMISION_TOTAL,
    });

    expect(resultado.cashInTillToday.toString()).toBe("10000");
    // Same net-kept formula as the app-paid case — commission is owed
    // regardless of who physically collected the cash today.
    expect(resultado.estimatedNetKept.toString()).toBe("6917");
  });

  it("cash-in-till and net-kept are independent figures, not conflated (asymmetry proof)", () => {
    const appPaid = computePyaEstimate({
      grossAmount: "5000",
      paymentMethod: "paid_in_app",
      comisionTotal: COMISION_TOTAL,
    });
    const cashCollected = computePyaEstimate({
      grossAmount: "5000",
      paymentMethod: "cash_collected_by_store",
      comisionTotal: COMISION_TOTAL,
    });

    // Same gross, same commission → same estimated net kept either way.
    expect(appPaid.estimatedNetKept.toString()).toBe(cashCollected.estimatedNetKept.toString());
    // But cash-in-till differs sharply: 0 vs the full gross amount.
    expect(appPaid.cashInTillToday.toString()).toBe("0");
    expect(cashCollected.cashInTillToday.toString()).toBe("5000");
  });

  it("rejects a zero or negative gross amount", () => {
    expect(() =>
      computePyaEstimate({
        grossAmount: "0",
        paymentMethod: "paid_in_app",
        comisionTotal: COMISION_TOTAL,
      }),
    ).toThrow(PyaEstimateValidationError);

    expect(() =>
      computePyaEstimate({
        grossAmount: "-100",
        paymentMethod: "paid_in_app",
        comisionTotal: COMISION_TOTAL,
      }),
    ).toThrow(PyaEstimateValidationError);
  });
});
