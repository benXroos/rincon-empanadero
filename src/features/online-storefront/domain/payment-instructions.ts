import type { SalePaymentMethod } from "@/features/sales-orders/application/register-sale";

/**
 * Pure, static order-confirmation payment content (spec "Cart, discounts,
 * shipping, fulfillment, checkout": checkout MUST display transfer alias
 * and cash-on-pickup only — Mercado Pago is explicitly OUT OF SCOPE for the
 * MVP). No DB/date/env/framework imports.
 *
 * MVP GAP NOTE (flagged, not silently resolved, same discipline as
 * `discount.ts`/`shipping.ts`): `BANK_TRANSFER_ALIAS` below is PLACEHOLDER
 * content. The owner MUST confirm the real bank-transfer alias/CBU before
 * going live — there is no real payment gateway integration in this MVP,
 * confirmation only tells the customer how to pay, it never verifies
 * payment was received.
 */
export const BANK_TRANSFER_ALIAS = "rincon.empanadero";

export interface PaymentInstructions {
  method: SalePaymentMethod;
  transferAlias?: string;
  message: string;
}

export function getPaymentInstructions(method: SalePaymentMethod): PaymentInstructions {
  if (method === "transfer") {
    return {
      method,
      transferAlias: BANK_TRANSFER_ALIAS,
      message: `Transferí el total a alias "${BANK_TRANSFER_ALIAS}" y enviá el comprobante para confirmar tu pedido.`,
    };
  }

  return {
    method,
    message: "Pagás en efectivo al retirar o recibir tu pedido.",
  };
}
