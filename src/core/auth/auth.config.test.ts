import { describe, expect, it } from "vitest";
import { authConfig } from "@/core/auth/auth.config";

/**
 * staff-attendance capability needs `session.user.id` to derive the
 * authenticated staff member for `markAttendance` — without it, a mutating
 * server action would have no non-spoofable way to know WHO is checking in.
 * Auth.js's JWT-strategy base session object only carries name/email/image
 * (see `@auth/core`'s `lib/actions/session.js`); `id` is not populated
 * unless the `session` callback explicitly copies it from `token.sub`
 * (which Auth.js's `callback` action sets to the authorize()-returned
 * `user.id` before invoking any custom callback).
 *
 * `authConfig.callbacks` is a plain object of functions with zero
 * next-auth/edge imports at the call site, so this is testable directly
 * with zero mocks (session/jwt callbacks receive plain objects).
 */
describe("authConfig.callbacks.session", () => {
  it("copies token.sub onto session.user.id", () => {
    const session = {
      user: { name: "Ana", email: "ana@rinconempanadero.test" },
      expires: "2026-08-20T00:00:00.000Z",
    };
    const token = { sub: "user-123", role: "colaborador" as const };

    // @ts-expect-error — the callback's declared param types are next-auth's
    // beta shapes; a minimal plain object is sufficient to exercise the
    // callback's actual logic (mirrors auth.config's own runtime casting).
    const result = authConfig.callbacks.session({ session, token });

    expect(result.user?.id).toBe("user-123");
  });

  it("resolves to a DIFFERENT id for a different token.sub (triangulation)", () => {
    const session = {
      user: { name: "Beto", email: "beto@rinconempanadero.test" },
      expires: "2026-08-20T00:00:00.000Z",
    };
    const token = { sub: "user-999", role: "admin" as const };

    // @ts-expect-error — see above.
    const result = authConfig.callbacks.session({ session, token });

    expect(result.user?.id).toBe("user-999");
  });
});
