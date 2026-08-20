import type {
  CustomerOrderLineInput,
  PlaceCustomerOrderInput,
} from "@/features/online-storefront/application/place-customer-order";

/**
 * Pure `FormData` → `PlaceCustomerOrderInput` parsing for the storefront
 * checkout form (`/tienda`). Kept separate from the "use server" action
 * itself so it is unit-testable with a plain `FormData` object — no
 * Next.js runtime required, mirroring how `domain/` stays framework-free
 * elsewhere in this project.
 *
 * Field naming convention the checkout form UI must follow:
 *  - `pack_<packId>_flavor_<flavorId>` — quantity of that flavor within a
 *    mixed-flavor pack selection.
 *  - `flavor_<flavorId>` — quantity of that flavor bought individually
 *    (outside any pack).
 *  - `fulfillment` (`"pickup"|"delivery"`), `postalCode`, `paymentMethod`
 *    (`"cash"|"transfer"`), `discountCode` (optional, blank = none).
 *
 * A pack is included in the resulting lines ONLY if at least one of its
 * slots has a nonzero quantity — an untouched pack section contributes
 * nothing, so the customer does not need to explicitly "skip" every pack
 * they are not ordering.
 */
export interface CheckoutFormCatalogContext {
  packs: { id: string; flavorIds: string[] }[];
  flavorIds: string[];
}

function readQuantity(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function readTrimmedOrUndefined(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function buildPlaceCustomerOrderInputFromFormData(
  formData: FormData,
  context: CheckoutFormCatalogContext,
): PlaceCustomerOrderInput {
  const lines: CustomerOrderLineInput[] = [];

  for (const pack of context.packs) {
    const selection: Record<string, number> = {};
    for (const flavorId of pack.flavorIds) {
      const quantity = readQuantity(formData, `pack_${pack.id}_flavor_${flavorId}`);
      if (quantity > 0) {
        selection[flavorId] = quantity;
      }
    }
    if (Object.keys(selection).length > 0) {
      lines.push({ itemType: "pack", packId: pack.id, selection });
    }
  }

  for (const flavorId of context.flavorIds) {
    const quantity = readQuantity(formData, `flavor_${flavorId}`);
    if (quantity > 0) {
      lines.push({ itemType: "flavor", flavorId, quantity });
    }
  }

  const fulfillment = formData.get("fulfillment") === "delivery" ? "delivery" : "pickup";
  const paymentMethod = formData.get("paymentMethod") === "transfer" ? "transfer" : "cash";

  return {
    lines,
    fulfillment,
    postalCode:
      fulfillment === "delivery" ? readTrimmedOrUndefined(formData, "postalCode") : undefined,
    paymentMethod,
    discountCode: readTrimmedOrUndefined(formData, "discountCode"),
  };
}
