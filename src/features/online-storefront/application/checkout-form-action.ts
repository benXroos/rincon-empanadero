"use server";

import { placeCustomerOrder } from "@/features/online-storefront/application/place-customer-order";
import {
  buildPlaceCustomerOrderInputFromFormData,
  type CheckoutFormCatalogContext,
} from "@/features/online-storefront/application/parse-checkout-form";
import { CartValidationError } from "@/features/online-storefront/domain/cart";
import { DiscountValidationError } from "@/features/online-storefront/domain/discount";
import { ShippingValidationError } from "@/features/online-storefront/domain/shipping";
import type { PaymentInstructions } from "@/features/online-storefront/domain/payment-instructions";

/**
 * "use server" action bound to the checkout `<form>` at `/tienda` via
 * `useActionState(submitCheckoutAction.bind(null, context), initialState)`
 * — the same `useActionState`-with-a-bound-extra-argument pattern used for
 * `authenticate.ts`/`login-form.tsx`, except `context` (the catalog shape
 * the form was rendered with) is bound ahead of the `(state, formData)`
 * pair `useActionState` itself supplies.
 *
 * Turns each of this feature's own validation errors (cart/discount/
 * shipping) into a user-facing message instead of an unhandled 500 —
 * mirrors `authenticate.ts`'s try/catch-and-narrow pattern. Any OTHER error
 * is re-thrown unchanged (never silently swallowed).
 */
export type CheckoutFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "success";
      orderId: string;
      total: string;
      paymentInstructions: PaymentInstructions;
    };

export async function submitCheckoutAction(
  context: CheckoutFormCatalogContext,
  _previousState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  try {
    const input = buildPlaceCustomerOrderInputFromFormData(formData, context);
    const result = await placeCustomerOrder(input);

    return {
      status: "success",
      orderId: result.order.id,
      total: result.order.totalAmount,
      paymentInstructions: result.paymentInstructions,
    };
  } catch (error) {
    if (
      error instanceof CartValidationError ||
      error instanceof DiscountValidationError ||
      error instanceof ShippingValidationError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}
