import { describe, expect, it } from "vitest";
import {
  validateDecomisoQuantity,
  DecomisoValidationError,
} from "@/features/purchase-expense-log/domain/validate-decomiso-entry";

/**
 * Pure domain logic for waste/decomiso tracking by flavor (mvp-decisions
 * #10, spec "purchase-expense-log"). No stock-quantity side effects — this
 * only validates the wasted quantity before it is logged.
 */
describe("validateDecomisoQuantity", () => {
  it("returns the quantity as a Decimal when it is a positive number", () => {
    const quantity = validateDecomisoQuantity("4");

    expect(quantity.toString()).toBe("4");
  });

  it("returns a different positive quantity unchanged (triangulation)", () => {
    const quantity = validateDecomisoQuantity("1.5");

    expect(quantity.toString()).toBe("1.5");
  });

  it("rejects a zero quantity", () => {
    expect(() => validateDecomisoQuantity("0")).toThrow(DecomisoValidationError);
  });

  it("rejects a negative quantity", () => {
    expect(() => validateDecomisoQuantity("-2")).toThrow(DecomisoValidationError);
  });
});
