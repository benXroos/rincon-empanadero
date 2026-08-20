import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseSettlementWorkbook, SettlementParseError } from "./parse-settlement-workbook";

/**
 * Parses against the REAL PedidosYa settlement fixture the owner provided
 * (sdd/rincon-empanadero-management-app/pedidosya-reconciliation-design) —
 * not hand-constructed fake rows — so this parser is proven against real
 * PedidosYa data, not just an assumed schema.
 */
const FIXTURE_PATH = join(__dirname, "../fixtures/estado-de-cuenta-ejemplo.xls");

describe("parseSettlementWorkbook (real PedidosYa fixture)", () => {
  it("parses all 26 real order rows from the 'Lista de Pedidos' sheet", () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const rows = parseSettlementWorkbook(buffer);

    expect(rows).toHaveLength(26);
  });

  it("parses the first row's exact real values", () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const rows = parseSettlementWorkbook(buffer);
    const first = rows[0];

    expect(first.orderNumber).toBe("2241896825");
    expect(first.orderDate.getUTCFullYear()).toBe(2026);
    expect(first.orderDate.getUTCMonth()).toBe(7); // August, 0-indexed
    expect(first.orderDate.getUTCDate()).toBe(16);
    expect(first.grossAmount.toString()).toBe("45000");
    expect(first.netSaleAmount.toString()).toBe("45000");
    expect(first.serviceFeeAmount.toString()).toBe("10350");
    expect(first.serviceFeePct.toString()).toBe("0.23");
    expect(first.paymentMethod).toBe("Pago fuera de la aplicación");
    expect(first.collectedBy).toBe("Tu Local");
  });

  it("parses an app-paid row's exact real values (payment-method variety)", () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const rows = parseSettlementWorkbook(buffer);
    const appPaid = rows.find((r) => r.orderNumber === "2241850618");

    expect(appPaid).toBeDefined();
    expect(appPaid?.paymentMethod).toBe("Pago en la aplicación");
    expect(appPaid?.collectedBy).toBe("PedidosYa");
    expect(appPaid?.grossAmount.toString()).toBe("15600");
    expect(appPaid?.netSaleAmount.toString()).toBe("12480");
    expect(appPaid?.serviceFeeAmount.toString()).toBe("2870.4");
  });

  it("every parsed order number is unique (real fixture proof, no duplicate rows)", () => {
    const buffer = readFileSync(FIXTURE_PATH);
    const rows = parseSettlementWorkbook(buffer);
    const orderNumbers = rows.map((r) => r.orderNumber);

    expect(new Set(orderNumbers).size).toBe(orderNumbers.length);
  });

  it("throws SettlementParseError when the expected sheet is missing", () => {
    const emptyWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(emptyWorkbook, XLSX.utils.aoa_to_sheet([["nope"]]), "Otra hoja");
    const buffer = XLSX.write(emptyWorkbook, { type: "buffer", bookType: "xlsx" });

    expect(() => parseSettlementWorkbook(buffer)).toThrow(SettlementParseError);
  });
});
