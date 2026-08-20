import {
  listPriceListItems,
  listPackPriceListItems,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";
import { getDiscountCodeByCode } from "@/features/online-storefront/infrastructure/storefront.repository";
import {
  computeSaleTotals,
  type SaleLineTotalInput,
} from "@/features/sales-orders/domain/compute-sale-totals";
import {
  applyDiscountCode,
  DiscountValidationError,
  type DiscountCodeRecord,
} from "@/features/online-storefront/domain/discount";
import type { Cart } from "@/features/online-storefront/domain/cart";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";

/**
 * Resolves each cart line's catalog price for `channel` and reduces them to
 * a subtotal via the already-tested `computeSaleTotals` (reused, not
 * reimplemented — same snapshot-shape a future checkout's `registerSale`
 * call will need). A pack line prices via its OWN fixed
 * `pack_price_list_items` entry (quantity of packs, NOT unit count) — NEVER
 * the sum of its chosen flavors' prices; this is the exact Phase 3
 * correction documented on `product-catalog.repository.ts#upsertPackPriceListItem`.
 * An optional `discountCode` is then applied to the subtotal via the pure
 * `domain/discount.ts#applyDiscountCode`.
 */
export interface CartLineTotal {
  itemType: "flavor" | "pack";
  itemId: string;
  quantity: number;
  unitPrice: SaleLineTotalInput["unitPrice"];
  lineTotal: ReturnType<typeof computeSaleTotals>["lines"][number]["lineTotal"];
}

export async function computeCartTotal(cart: Cart, channel: SalesChannel, discountCode?: string) {
  const lineInputs: SaleLineTotalInput[] = [];
  const lineMeta: { itemType: "flavor" | "pack"; itemId: string }[] = [];

  for (const line of cart.lines) {
    if (line.itemType === "flavor") {
      const priceItems = await listPriceListItems(line.flavorId);
      const priceItem = priceItems.find((item) => item.channel === channel);

      if (!priceItem) {
        throw new DiscountValidationError(`No ${channel} price found for flavor ${line.flavorId}.`);
      }

      lineInputs.push({ quantity: line.quantity, unitPrice: priceItem.price });
      lineMeta.push({ itemType: "flavor", itemId: line.flavorId });
    } else {
      const priceItems = await listPackPriceListItems(line.packId);
      const priceItem = priceItems.find((item) => item.channel === channel);

      if (!priceItem) {
        throw new DiscountValidationError(`No ${channel} price found for pack ${line.packId}.`);
      }

      // A pack line is priced once at its own fixed price — the quantity
      // dimension here is "one pack", never the pack's unit count.
      lineInputs.push({ quantity: 1, unitPrice: priceItem.price });
      lineMeta.push({ itemType: "pack", itemId: line.packId });
    }
  }

  const { lines: computedLines, orderTotal: subtotal } = computeSaleTotals(lineInputs);

  let discount: DiscountCodeRecord | undefined;
  if (discountCode) {
    const found = await getDiscountCodeByCode(discountCode);

    if (!found) {
      throw new DiscountValidationError(`Discount code "${discountCode}" does not exist.`);
    }

    discount = { code: found.code, type: found.type, value: found.value, active: found.active };
  }

  const total = applyDiscountCode(subtotal, discount);

  const lines: CartLineTotal[] = computedLines.map((computed, index) => ({
    ...lineMeta[index]!,
    quantity: computed.quantity,
    unitPrice: computed.unitPrice,
    lineTotal: computed.lineTotal,
  }));

  return { lines, subtotal, total };
}
