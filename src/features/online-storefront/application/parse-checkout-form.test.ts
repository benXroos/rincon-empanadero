import { describe, expect, it } from "vitest";
import { buildPlaceCustomerOrderInputFromFormData } from "@/features/online-storefront/application/parse-checkout-form";

/**
 * Pure FormData → `PlaceCustomerOrderInput` parsing for the storefront
 * checkout form. Kept separate from the "use server" action itself so it
 * is unit-testable with a plain `FormData` object, no Next.js runtime
 * required.
 */
describe("buildPlaceCustomerOrderInputFromFormData", () => {
  const context = {
    packs: [{ id: "pack-1", flavorIds: ["flavor-a", "flavor-b"] }],
    flavorIds: ["flavor-c"],
  };

  it("builds a pack line only for pack slots with a nonzero quantity", () => {
    const formData = new FormData();
    formData.set("pack_pack-1_flavor_flavor-a", "8");
    formData.set("pack_pack-1_flavor_flavor-b", "4");
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    const result = buildPlaceCustomerOrderInputFromFormData(formData, context);

    expect(result.lines).toEqual([
      { itemType: "pack", packId: "pack-1", selection: { "flavor-a": 8, "flavor-b": 4 } },
    ]);
  });

  it("builds a flavor line for a directly-bought flavor with a nonzero quantity", () => {
    const formData = new FormData();
    formData.set("flavor_flavor-c", "3");
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    const result = buildPlaceCustomerOrderInputFromFormData(formData, context);

    expect(result.lines).toEqual([{ itemType: "flavor", flavorId: "flavor-c", quantity: 3 }]);
  });

  it("omits a pack entirely when every one of its slot quantities is zero or absent", () => {
    const formData = new FormData();
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    const result = buildPlaceCustomerOrderInputFromFormData(formData, context);

    expect(result.lines).toEqual([]);
  });

  it("defaults to pickup/cash and keeps postalCode/discountCode undefined when blank", () => {
    const formData = new FormData();
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");
    formData.set("postalCode", "");
    formData.set("discountCode", "  ");

    const result = buildPlaceCustomerOrderInputFromFormData(formData, context);

    expect(result.fulfillment).toBe("pickup");
    expect(result.paymentMethod).toBe("cash");
    expect(result.postalCode).toBeUndefined();
    expect(result.discountCode).toBeUndefined();
  });

  it("carries a trimmed postal code and discount code through for delivery + transfer", () => {
    const formData = new FormData();
    formData.set("fulfillment", "delivery");
    formData.set("postalCode", " 1900 ");
    formData.set("paymentMethod", "transfer");
    formData.set("discountCode", " PROMO10 ");

    const result = buildPlaceCustomerOrderInputFromFormData(formData, context);

    expect(result.fulfillment).toBe("delivery");
    expect(result.postalCode).toBe("1900");
    expect(result.paymentMethod).toBe("transfer");
    expect(result.discountCode).toBe("PROMO10");
  });

  it("never carries a postal code through for pickup, even if one was submitted", () => {
    const formData = new FormData();
    formData.set("fulfillment", "pickup");
    formData.set("postalCode", "1900");
    formData.set("paymentMethod", "cash");

    const result = buildPlaceCustomerOrderInputFromFormData(formData, context);

    expect(result.postalCode).toBeUndefined();
  });
});
