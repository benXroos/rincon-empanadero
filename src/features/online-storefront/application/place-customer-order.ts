"use server";

import {
  addFlavorToCart,
  addPackToCart,
} from "@/features/online-storefront/application/cart-service";
import { computeCheckoutTotal } from "@/features/online-storefront/application/compute-checkout-total";
import {
  insertSalesOrder,
  insertSalesOrderLines,
} from "@/features/sales-orders/infrastructure/sales-order.repository";
import {
  getPaymentInstructions,
  type PaymentInstructions,
} from "@/features/online-storefront/domain/payment-instructions";
import type { Cart } from "@/features/online-storefront/domain/cart";
import type { FulfillmentMethod } from "@/features/online-storefront/domain/shipping";
import type { SalePaymentMethod } from "@/features/sales-orders/application/register-sale";

/**
 * `placeCustomerOrder` — the NEW, SEPARATE public checkout action resolved
 * by `sdd/rincon-empanadero-management-app/checkout-auth-decision`. This is
 * NOT `registerSale`: it has NO `requireRole`/`requireSession` call
 * anywhere, by design — an anonymous storefront customer has no staff
 * login, and `registerSale` stays staff-only for manual walk-in/phone sale
 * entry (do not weaken that gate to accommodate this).
 *
 * Its input is shaped for a CUSTOMER's cart (raw flavor/pack line requests),
 * not a copy of `registerSale`'s "already-resolved unit price" shape — a
 * customer never supplies a price. Each line is rebuilt through the
 * EXISTING, already-tested `cart-service.ts#addFlavorToCart`/`addPackToCart`
 * so availability/eligibility/pack-composition rules are re-validated
 * against the CURRENT catalog state at checkout time, not trusted from
 * whatever the client last fetched — a crafted request cannot bypass those
 * rules by skipping the browsing UI. Pricing then goes through
 * `computeCheckoutTotal` (reusing `computeCartTotal` + shipping, never
 * re-resolving a catalog price itself), and persistence reuses the exact
 * same `sales_orders`/`sales_order_lines` repository `registerSale` writes
 * to — channel is always `"own"` (this action only exists for the own
 * storefront; PedidosYa has no public checkout).
 */
export interface CustomerOrderFlavorLineInput {
  itemType: "flavor";
  flavorId: string;
  quantity: number;
}

export interface CustomerOrderPackLineInput {
  itemType: "pack";
  packId: string;
  selection: Record<string, number>;
}

export type CustomerOrderLineInput = CustomerOrderFlavorLineInput | CustomerOrderPackLineInput;

export interface PlaceCustomerOrderInput {
  lines: CustomerOrderLineInput[];
  fulfillment: FulfillmentMethod;
  /** Required when `fulfillment` is `"delivery"`; ignored (never stored) for `"pickup"`. */
  postalCode?: string;
  paymentMethod: SalePaymentMethod;
  discountCode?: string;
}

export interface PlaceCustomerOrderResult {
  order: Awaited<ReturnType<typeof insertSalesOrder>>;
  lines: Awaited<ReturnType<typeof insertSalesOrderLines>>;
  paymentInstructions: PaymentInstructions;
}

export async function placeCustomerOrder(
  input: PlaceCustomerOrderInput,
): Promise<PlaceCustomerOrderResult> {
  let cart: Cart = { lines: [] };

  for (const line of input.lines) {
    cart =
      line.itemType === "flavor"
        ? await addFlavorToCart(cart, { flavorId: line.flavorId, quantity: line.quantity })
        : await addPackToCart(cart, { packId: line.packId, selection: line.selection });
  }

  const { lines: pricedLines, total } = await computeCheckoutTotal({
    cart,
    channel: "own",
    fulfillment: input.fulfillment,
    postalCode: input.postalCode,
    discountCode: input.discountCode,
  });

  const order = await insertSalesOrder({
    channel: "own",
    paymentMethod: input.paymentMethod,
    totalAmount: total.toString(),
    fulfillmentMethod: input.fulfillment,
    postalCode: input.fulfillment === "delivery" ? (input.postalCode ?? null) : null,
  });

  const orderLines = await insertSalesOrderLines(
    pricedLines.map((line) => ({
      salesOrderId: order.id,
      itemType: line.itemType,
      itemId: line.itemId,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPrice.toString(),
      lineTotal: line.lineTotal.toString(),
    })),
  );

  return {
    order,
    lines: orderLines,
    paymentInstructions: getPaymentInstructions(input.paymentMethod),
  };
}
