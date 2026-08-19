"use server";

import { requireRole } from "@/core/auth/require-role.server";
import { insertPack } from "@/features/product-catalog/infrastructure/product-catalog.repository";

export interface CreatePackInput {
  name: string;
  unitCount: number;
}

export async function createPack(input: CreatePackInput) {
  await requireRole(["admin"]);

  return insertPack(input);
}
