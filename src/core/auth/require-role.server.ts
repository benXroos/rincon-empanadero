import { auth } from "@/core/auth/auth";
import { assertRole, type Role } from "@/core/auth/require-role";

/**
 * Reads the current Auth.js session and enforces `assertRole` against it.
 * Throws UnauthorizedError (never returns a falsy/partial result) when the
 * caller is unauthenticated or has the wrong role. This wrapper is the one
 * imported by server actions/layouts; it is NOT unit-tested directly (it
 * requires a real Next.js request context) — `assertRole` carries the
 * tested logic, and this file is mocked as a single dependency in the
 * server-action tests that use it.
 */
export async function requireRole(allowedRoles: Role[]) {
  const session = await auth();
  assertRole(session?.user?.role, allowedRoles);
  return session!;
}
