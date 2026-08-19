import { describe, expect, it } from "vitest";
import { assertRole, UnauthorizedError } from "@/core/auth/require-role";

describe("assertRole", () => {
  it("allows a role that is in the allowed list", () => {
    expect(() => assertRole("admin", ["admin"])).not.toThrow();
  });

  it("throws UnauthorizedError when the role is not in the allowed list", () => {
    expect(() => assertRole("colaborador", ["admin"])).toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError when there is no role at all (unauthenticated)", () => {
    expect(() => assertRole(undefined, ["admin"])).toThrow(UnauthorizedError);
  });

  it("allows a role when the allowed list has multiple roles", () => {
    expect(() => assertRole("colaborador", ["admin", "colaborador"])).not.toThrow();
  });
});
