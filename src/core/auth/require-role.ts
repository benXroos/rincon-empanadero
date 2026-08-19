/**
 * Deny-by-default authorization gate (design decision #5): pure role-check
 * logic only. Deliberately has ZERO imports from next-auth/Auth.js so it is
 * unit-testable without a Next.js request/edge runtime — importing `auth()`
 * transitively pulls in `next/server`, which Vitest's plain node
 * environment cannot resolve. The I/O wrapper that calls the real session
 * lives in `require-role.server.ts`.
 *
 * This is the FIRST wiring instance, added early because task 2.4
 * (admin-only pricing percentage edit) needs an enforcement point now,
 * ahead of Phase 4 (access-control), which will WIDEN this gate's usage
 * into every protected server action/layout — Phase 4 task 4.1 should
 * EXTEND these files, not recreate them.
 */
export type Role = "admin" | "colaborador";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Throws UnauthorizedError unless `role` is defined and is one of
 * `allowedRoles`. Kept separate from session-fetching so it is testable
 * with zero mocks.
 */
export function assertRole(role: Role | undefined, allowedRoles: Role[]): void {
  if (!role || !allowedRoles.includes(role)) {
    throw new UnauthorizedError();
  }
}
