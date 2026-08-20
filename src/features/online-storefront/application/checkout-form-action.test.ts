import { describe, expect, it, vi, beforeEach } from "vitest";
import { CartValidationError } from "@/features/online-storefront/domain/cart";
import { DiscountValidationError } from "@/features/online-storefront/domain/discount";
import { ShippingValidationError } from "@/features/online-storefront/domain/shipping";

const { placeCustomerOrderMock } = vi.hoisted(() => ({
  placeCustomerOrderMock: vi.fn(),
}));

vi.mock("@/features/online-storefront/application/place-customer-order", () => ({
  placeCustomerOrder: placeCustomerOrderMock,
}));

const { submitCheckoutAction } =
  await import("@/features/online-storefront/application/checkout-form-action");

/**
 * The "use server" action bound to the checkout `<form>`
 * (`useActionState(submitCheckoutAction.bind(null, context), ...)`, same
 * pattern `authenticate.ts` established for the login form). Parses the
 * submitted `FormData` via the already-tested pure
 * `parse-checkout-form.ts#buildPlaceCustomerOrderInputFromFormData`, calls
 * `placeCustomerOrder`, and turns a business-rule rejection into a
 * user-facing error string rather than an unhandled 500.
 */
describe("submitCheckoutAction", () => {
  const context = { packs: [], flavorIds: ["flavor-1"] };

  beforeEach(() => {
    placeCustomerOrderMock.mockReset();
  });

  it("returns a success state with the order id, total, and payment instructions", async () => {
    placeCustomerOrderMock.mockResolvedValueOnce({
      order: { id: "order-1", totalAmount: "5000.00" },
      lines: [],
      paymentInstructions: { method: "cash", message: "Pagás en efectivo al retirar." },
    });

    const formData = new FormData();
    formData.set("flavor_flavor-1", "2");
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    const state = await submitCheckoutAction(context, { status: "idle" }, formData);

    expect(state).toEqual({
      status: "success",
      orderId: "order-1",
      total: "5000.00",
      paymentInstructions: { method: "cash", message: "Pagás en efectivo al retirar." },
    });
  });

  it("turns a CartValidationError into a user-facing error state", async () => {
    placeCustomerOrderMock.mockRejectedValueOnce(new CartValidationError("Selección inválida."));

    const formData = new FormData();
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    const state = await submitCheckoutAction(context, { status: "idle" }, formData);

    expect(state).toEqual({ status: "error", message: "Selección inválida." });
  });

  it("turns a DiscountValidationError into a user-facing error state", async () => {
    placeCustomerOrderMock.mockRejectedValueOnce(
      new DiscountValidationError('Discount code "BAD" does not exist.'),
    );

    const formData = new FormData();
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    const state = await submitCheckoutAction(context, { status: "idle" }, formData);

    expect(state).toEqual({
      status: "error",
      message: 'Discount code "BAD" does not exist.',
    });
  });

  it("turns a ShippingValidationError into a user-facing error state", async () => {
    placeCustomerOrderMock.mockRejectedValueOnce(
      new ShippingValidationError("A postal code is required for delivery."),
    );

    const formData = new FormData();
    formData.set("fulfillment", "delivery");
    formData.set("paymentMethod", "cash");

    const state = await submitCheckoutAction(context, { status: "idle" }, formData);

    expect(state).toEqual({
      status: "error",
      message: "A postal code is required for delivery.",
    });
  });

  it("re-throws an unexpected error rather than swallowing it into an error state", async () => {
    placeCustomerOrderMock.mockRejectedValueOnce(new Error("unexpected"));

    const formData = new FormData();
    formData.set("fulfillment", "pickup");
    formData.set("paymentMethod", "cash");

    await expect(submitCheckoutAction(context, { status: "idle" }, formData)).rejects.toThrow(
      "unexpected",
    );
  });
});
