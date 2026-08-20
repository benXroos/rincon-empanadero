import {
  getPackById,
  listEligibleFlavorsForPack,
  listAvailableFlavors,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";
import {
  addFlavorLine,
  addPackLine,
  CartValidationError,
  type Cart,
  type AddFlavorLineInput,
} from "@/features/online-storefront/domain/cart";

/**
 * Wires the pure `domain/cart.ts` validators to the DB-resolved sets they
 * need (spec "Mixed-flavor pack selection" + individually-sold flavors) —
 * holds no business logic of its own, matching the split
 * `product-catalog.repository.ts`/`domain/pack-selection.ts` already
 * establish. PUBLIC — reachable by an anonymous customer browsing the
 * storefront, no `requireRole`/`requireSession` call, same as
 * `browse-catalog.ts`.
 */

/**
 * Adds an individually-sold flavor line, rejecting a flavor that is not
 * CURRENTLY available (spec scenario "Toggle hides from storefront" — the
 * toggle must be enforced at add-to-cart time, not just at browse time, so
 * a stale client cannot add a flavor an admin just hid).
 */
export async function addFlavorToCart(cart: Cart, input: AddFlavorLineInput): Promise<Cart> {
  const available = await listAvailableFlavors();
  const availableIds = available.map((flavor) => flavor.id);

  if (!availableIds.includes(input.flavorId)) {
    throw new CartValidationError(`Flavor ${input.flavorId} is not available.`);
  }

  return addFlavorLine(cart, input);
}

export interface AddPackToCartInput {
  packId: string;
  selection: Record<string, number>;
}

/**
 * Adds a mixed-flavor pack line (spec scenario "Customer builds mixed
 * docena"), resolving the pack's `unitCount`, its raw eligibility set
 * (`listEligibleFlavorsForPack`), and the CURRENT global availability set
 * (`listAvailableFlavors`) as two DISTINCT sets before delegating to the
 * pure `addPackLine` — see `domain/cart.ts`'s docs for why these must stay
 * separate rather than reusing `listChoosableFlavorsForPack`'s intersection.
 */
export async function addPackToCart(cart: Cart, input: AddPackToCartInput): Promise<Cart> {
  const pack = await getPackById(input.packId);

  if (!pack) {
    throw new CartValidationError(`Pack ${input.packId} does not exist.`);
  }

  const [eligibleFlavors, availableFlavors] = await Promise.all([
    listEligibleFlavorsForPack(input.packId),
    listAvailableFlavors(),
  ]);

  return addPackLine(cart, {
    pack: { id: pack.id, unitCount: pack.unitCount },
    eligibleFlavorIds: eligibleFlavors.map((flavor) => flavor.id),
    availableFlavorIds: availableFlavors.map((flavor) => flavor.id),
    selection: input.selection,
  });
}
