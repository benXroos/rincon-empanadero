import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * `next-auth`'s real top-level module unconditionally imports `next/server`
 * (via `lib/env.js`), which Vitest's plain node environment cannot resolve
 * — the exact same constraint documented in `require-role.ts` for why that
 * file never imports `next-auth` directly. Mocking the whole module (with
 * minimal error classes matching the real `AuthError`/`CredentialsSignin`
 * shape) keeps `authenticate.ts`'s production code idiomatic — it imports
 * `AuthError` from `"next-auth"` exactly as Auth.js's own docs recommend —
 * while never evaluating the real, Next.js-only module graph under Vitest.
 */
class FakeAuthError extends Error {}
class FakeCredentialsSignin extends FakeAuthError {}

vi.mock("next-auth", () => ({
  AuthError: FakeAuthError,
  CredentialsSignin: FakeCredentialsSignin,
}));

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
}));

vi.mock("@/core/auth/auth", () => ({
  signIn: signInMock,
}));

const { authenticate } = await import("@/core/auth/authenticate");

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("authenticate (login server action)", () => {
  beforeEach(() => {
    signInMock.mockReset();
  });

  it("returns a Spanish error message when signIn rejects with an AuthError", async () => {
    signInMock.mockRejectedValueOnce(new FakeCredentialsSignin());

    const result = await authenticate(
      undefined,
      buildFormData({ email: "a@a.com", password: "wrong" }),
    );

    expect(result).toBe("Email o contraseña incorrectos.");
  });

  it("re-throws non-auth errors instead of swallowing them", async () => {
    signInMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(
      authenticate(undefined, buildFormData({ email: "a@a.com", password: "right" })),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("calls signIn with the credentials provider and the exact submitted fields", async () => {
    signInMock.mockResolvedValueOnce(undefined);

    await authenticate(
      undefined,
      buildFormData({ email: "a@a.com", password: "right", callbackUrl: "/admin/catalog" }),
    );

    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "a@a.com",
      password: "right",
      redirectTo: "/admin/catalog",
    });
  });

  it("defaults redirectTo to /admin/catalog when no callbackUrl was submitted", async () => {
    signInMock.mockResolvedValueOnce(undefined);

    await authenticate(undefined, buildFormData({ email: "a@a.com", password: "right" }));

    expect(signInMock).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ redirectTo: "/admin/catalog" }),
    );
  });
});
