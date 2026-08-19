/**
 * Pure availability filtering (spec capability "product-catalog", requirement
 * "Availability toggle": an unavailable flavor "MUST NOT appear as a
 * choosable option" anywhere storefront-wide). Independent of stock
 * quantity — `isAvailable` is a plain admin-controlled boolean.
 */
export interface AvailabilityAware {
  isAvailable: boolean;
}

export function filterAvailable<T extends AvailabilityAware>(items: T[]): T[] {
  return items.filter((item) => item.isAvailable);
}
