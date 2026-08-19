"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { upsertPackPriceListItem } from "@/features/product-catalog/infrastructure/product-catalog.repository";
import type { SalesChannel } from "@/features/pricing/domain/resolve-active-profile";

/**
 * Admin-only use-case for a pack's per-channel fixed price. CORRECTION
 * (post-Phase-3): a pack's sale price is its own admin-set fixed value —
 * it must never be computed by summing its chosen flavors' prices (see
 * `product-catalog.repository.ts`'s `upsertPackPriceListItem` docs).
 */
export interface SetPackPriceInput {
  packId: string;
  channel: SalesChannel;
  price: string;
}

export async function setPackPrice(input: SetPackPriceInput) {
  await requireRole(["admin"]);

  return upsertPackPriceListItem(input.packId, input.channel, input.price);
}
