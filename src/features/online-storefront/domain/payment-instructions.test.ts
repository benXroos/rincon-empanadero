import { describe, expect, it } from "vitest";
import { getPaymentInstructions } from "@/features/online-storefront/domain/payment-instructions";

/**
 * Spec "Cart, discounts, shipping, fulfillment, checkout": checkout MUST
 * show bank-transfer alias and cash-on-pickup only — no Mercado Pago. This
 * is static MVP content (no real payment gateway), shown to the customer on
 * the order confirmation screen after `placeCustomerOrder`.
 */
describe("getPaymentInstructions", () => {
  it("returns the bank-transfer alias and a transfer message for transfer", () => {
    const result = getPaymentInstructions("transfer");

    expect(result.method).toBe("transfer");
    expect(result.transferAlias).toBeTruthy();
    expect(result.message).toContain(result.transferAlias!);
  });

  it("returns a cash-on-pickup message with no transfer alias for cash", () => {
    const result = getPaymentInstructions("cash");

    expect(result.method).toBe("cash");
    expect(result.transferAlias).toBeUndefined();
    expect(result.message.length).toBeGreaterThan(0);
  });
});
