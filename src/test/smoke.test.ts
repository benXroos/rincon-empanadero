import { describe, expect, it } from "vitest";

/**
 * Proves the Vitest toolchain itself runs green before any feature work
 * starts. Real domain tests begin in Phase 2 (pricing-engine), where
 * Strict TDD turns on — see sdd/rinconempanadero/testing-capabilities.
 */
describe("toolchain smoke test", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
