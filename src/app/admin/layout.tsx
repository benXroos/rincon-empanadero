import type { ReactNode } from "react";
import { requireSession } from "@/core/auth/require-role.server";

/**
 * Shared server-side gate for every `/admin/*` route (Phase 4, task 4.1 —
 * design decision #5: the real authorization gate is server-side, never
 * middleware alone). Requires ANY authenticated session: both admin and
 * colaborador may view admin pages per the spec's access-control table
 * ("View availability/inventory: Yes (read-only)" for colaborador).
 * Role-specific denial for MUTATIONS is enforced independently by each
 * server action's own `requireRole(["admin"])` call — already true for
 * every Phase 2/3 admin-only action, unchanged by this batch.
 *
 * `src/middleware.ts` also redirects unauthenticated `/admin/*` requests
 * to `/login` at the edge, but that is a UX nicety only — this layout is
 * what actually enforces access, so it stays correct even if the
 * middleware file were ever deleted.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return <>{children}</>;
}
