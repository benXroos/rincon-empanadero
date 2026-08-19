import { redirect } from "next/navigation";
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

/**
 * Phase 4 (access-control), task 4.1: the shared gate for every protected
 * LAYOUT (design decision #5 — "called in every server action and
 * protected layout"). Unlike `requireRole()`, which throws `UnauthorizedError`
 * for a mutating server action, this redirects to `/login` — a page view is
 * a navigation, not an API call, so a thrown error would surface Next.js's
 * generic error boundary instead of a usable UX. It intentionally accepts
 * ANY authenticated role (both admin and colaborador may VIEW protected
 * pages per the spec's access-control table); role-specific denial for
 * MUTATIONS stays in each server action's own `requireRole(["admin"])` call.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session!;
}
