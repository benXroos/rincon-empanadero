"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { insertFlavor } from "@/features/product-catalog/infrastructure/product-catalog.repository";

export interface CreateFlavorInput {
  productId: string;
  name: string;
  costoMateriales: string;
}

export async function createFlavor(input: CreateFlavorInput) {
  await requireRole(["admin"]);

  return insertFlavor(input);
}
