import { describe, expect, it } from "vitest";
import { aggregateSalesByChannel } from "./aggregate-sales-by-channel";

describe("aggregateSalesByChannel", () => {
  it("groups totals per channel from a single mixed-channel query result", () => {
    const resultado = aggregateSalesByChannel([
      { channel: "own", totalAmount: "10000" },
      { channel: "pedidosya", totalAmount: "5000" },
      { channel: "own", totalAmount: "2500" },
    ]);

    expect(resultado.own.orderCount).toBe(2);
    expect(resultado.own.totalAmount.toString()).toBe("12500");
    expect(resultado.pedidosya.orderCount).toBe(1);
    expect(resultado.pedidosya.totalAmount.toString()).toBe("5000");
  });

  it("returns zeroed buckets for a channel with no orders in range (triangulation)", () => {
    const resultado = aggregateSalesByChannel([{ channel: "pedidosya", totalAmount: "1000" }]);

    expect(resultado.own.orderCount).toBe(0);
    expect(resultado.own.totalAmount.toString()).toBe("0");
    expect(resultado.pedidosya.orderCount).toBe(1);
  });

  it("returns zeroed buckets for both channels on an empty range", () => {
    const resultado = aggregateSalesByChannel([]);

    expect(resultado.own.orderCount).toBe(0);
    expect(resultado.own.totalAmount.toString()).toBe("0");
    expect(resultado.pedidosya.orderCount).toBe(0);
    expect(resultado.pedidosya.totalAmount.toString()).toBe("0");
  });
});
