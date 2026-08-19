"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { setPackFlavors as setPackFlavorsRepo } from "@/features/product-catalog/infrastructure/product-catalog.repository";

/**
 * Admin-only use-case configuring which flavors a customer may choose from
 * within a pack (spec "Mixed-flavor pack selection"). Full replace, not an
 * incremental add/remove — see `product-catalog.repository.setPackFlavors`.
 */
export interface SetPackFlavorsInput {
  packId: string;
  flavorIds: string[];
}

export async function setPackFlavors(input: SetPackFlavorsInput) {
  await requireRole(["admin"]);

  return setPackFlavorsRepo(input.packId, input.flavorIds);
}
