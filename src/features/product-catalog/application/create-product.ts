"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { insertProduct } from "@/features/product-catalog/infrastructure/product-catalog.repository";

export interface CreateProductInput {
  name: string;
}

export async function createProduct(input: CreateProductInput) {
  await requireRole(["admin"]);

  return insertProduct(input);
}
