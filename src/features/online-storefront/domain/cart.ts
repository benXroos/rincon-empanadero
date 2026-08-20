import { validatePackSelection } from "@/features/product-catalog/domain/pack-selection";

/**
 * Pure cart domain (spec capability "online-storefront", requirements
 * "Mixed-flavor pack selection" and "Cart, discounts, shipping, fulfillment,
 * checkout"). No DB/date/env/framework imports — mirrors the isolation
 * pattern of `pricing/domain/calculator.ts` and this feature's own
 * `domain/discount.ts`.
 *
 * A cart holds two kinds of lines:
 *  - a `flavor` line: an individually-sold flavor with a plain quantity.
 *  - a `pack` line: a multi-unit pack (docena/media docena) with a
 *    per-flavor breakdown (`selection`) that must total the pack's
 *    `unitCount` and only reference flavors that are BOTH eligible for the
 *    pack AND currently available — validated by the already-tested
 *    `product-catalog/domain/pack-selection.ts#validatePackSelection`,
 *    reused here rather than reimplemented (per the tasks note).
 *
 * `eligibleFlavorIds`/`availableFlavorIds` are DB-resolved sets the caller
 * (the application layer) must fetch and pass in — this module has no I/O.
 */
export interface FlavorCartLine {
  itemType: "flavor";
  flavorId: string;
  quantity: number;
}

export interface PackCartLine {
  itemType: "pack";
  packId: string;
  selection: Record<string, number>;
}

export type CartLine = FlavorCartLine | PackCartLine;

export interface Cart {
  lines: CartLine[];
}

export class CartValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartValidationError";
  }
}

export interface AddFlavorLineInput {
  flavorId: string;
  quantity: number;
}

/**
 * Appends an individually-sold flavor line. Does not check availability
 * itself — the application layer must resolve `availableFlavorIds` first
 * and reject an unavailable flavor before calling this (mirrors how
 * `addPackLine` needs its sets resolved by the caller too).
 */
export function addFlavorLine(cart: Cart, input: AddFlavorLineInput): Cart {
  if (input.quantity <= 0) {
    throw new CartValidationError("Flavor line quantity must be greater than zero.");
  }

  const line: FlavorCartLine = {
    itemType: "flavor",
    flavorId: input.flavorId,
    quantity: input.quantity,
  };

  return { lines: [...cart.lines, line] };
}

export interface AddPackLineInput {
  pack: { id: string; unitCount: number };
  eligibleFlavorIds: string[];
  availableFlavorIds: string[];
  selection: Record<string, number>;
}

/**
 * Appends a mixed-flavor pack line (spec scenario "Customer builds mixed
 * docena"). Throws `CartValidationError` — with `validatePackSelection`'s
 * exact error messages joined — for a mismatched total, an ineligible
 * flavor, or a flavor that is no longer available even though it was
 * eligible (spec scenario "Unavailable flavor excluded from pack").
 */
export function addPackLine(cart: Cart, input: AddPackLineInput): Cart {
  const result = validatePackSelection({
    unitCount: input.pack.unitCount,
    eligibleFlavorIds: input.eligibleFlavorIds,
    availableFlavorIds: input.availableFlavorIds,
    selection: input.selection,
  });

  if (!result.valid) {
    throw new CartValidationError(result.errors.join("; "));
  }

  const line: PackCartLine = {
    itemType: "pack",
    packId: input.pack.id,
    selection: input.selection,
  };

  return { lines: [...cart.lines, line] };
}
