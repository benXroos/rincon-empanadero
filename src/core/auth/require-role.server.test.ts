import { describe, expect, it, vi, beforeEach } from "vitest";

const { authMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/core/auth/auth", () => ({
  auth: authMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const { requireSession } = await import("@/core/auth/require-role.server");

describe("requireSession (authenticated-only layout/page gate)", () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to /login when there is no session at all", async () => {
    authMock.mockResolvedValueOnce(null);
    redirectMock.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when the session has no user", async () => {
    authMock.mockResolvedValueOnce({ user: undefined });
    redirectMock.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns the session unchanged when a session exists, without redirecting", async () => {
    const session = { user: { role: "admin" as const, email: "a@a.com" } };
    authMock.mockResolvedValueOnce(session);

    const result = await requireSession();

    expect(result).toBe(session);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
