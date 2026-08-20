import * as XLSX from "xlsx";
import Decimal from "decimal.js";

/**
 * Parses a PedidosYa real settlement Excel export ("estado de cuenta",
 * despite the `.xls` extension it is actually OOXML/`.xlsx`) into
 * structured rows. Column names and shape are taken verbatim from the
 * REAL fixture the owner provided
 * (`src/features/pedidosya-reconciliation/fixtures/estado-de-cuenta-ejemplo.xls`)
 * — see sdd/rincon-empanadero-management-app/pedidosya-reconciliation-design.
 * This is infrastructure (depends on the third-party `xlsx` library), not
 * domain — mirrors how a Drizzle repository is infra, not domain.
 */
const SHEET_NAME = "Lista de Pedidos";

export interface ParsedSettlementRow {
  orderNumber: string;
  orderDate: Date;
  grossAmount: Decimal;
  netSaleAmount: Decimal;
  serviceFeeAmount: Decimal;
  serviceFeePct: Decimal;
  /** Raw value: "Pago en la aplicación" | "Pago fuera de la aplicación". */
  paymentMethod: string;
  /** Raw value: "PedidosYa" | "Tu Local". */
  collectedBy: string;
}

export class SettlementParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementParseError";
  }
}

type RawSettlementRow = Record<string, unknown>;

export function parseSettlementWorkbook(buffer: Buffer | ArrayBuffer): ParsedSettlementRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new SettlementParseError(
      `Expected sheet "${SHEET_NAME}" was not found in the uploaded settlement file. ` +
        `Sheets present: ${workbook.SheetNames.join(", ")}`,
    );
  }

  const rawRows = XLSX.utils.sheet_to_json<RawSettlementRow>(sheet, { defval: null });

  return rawRows.filter((row) => row["Número de pedido"] != null).map(parseRow);
}

function parseRow(row: RawSettlementRow): ParsedSettlementRow {
  return {
    orderNumber: String(row["Número de pedido"]),
    orderDate: parseDdMmYyyy(String(row["Fecha de pedido"] ?? "")),
    grossAmount: toDecimal(row["Monto bruto de la venta"]),
    netSaleAmount: toDecimal(row["Monto de Venta Neta ($)"]),
    serviceFeeAmount: toDecimal(row["Servicio Ventas PedidoYa ($)"]),
    serviceFeePct: parsePercent(String(row["Servicio Ventas PedidosYA (%)"] ?? "0%")),
    paymentMethod: String(row["Método de pago"] ?? ""),
    collectedBy: String(row["Cobrado por"] ?? ""),
  };
}

function toDecimal(value: unknown): Decimal {
  return new Decimal((value as Decimal.Value) ?? 0);
}

/** PedidosYa's real file stores order dates as `DD/MM/YYYY` text cells. */
function parseDdMmYyyy(value: string): Date {
  const [day, month, year] = value.split("/").map((part) => Number(part));

  if (!day || !month || !year) {
    throw new SettlementParseError(`Could not parse "Fecha de pedido" value: "${value}"`);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

/** PedidosYa's real file stores commission percentage as `"23.00%"` text. */
function parsePercent(value: string): Decimal {
  return new Decimal(value.replace("%", "").trim()).div(100);
}
