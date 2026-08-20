"use server";

import { requireSession } from "@/core/auth/require-role.server";
import { normalizeAttendanceDate } from "@/features/staff-attendance/domain/normalize-attendance-date";
import { upsertAttendanceLog } from "@/features/staff-attendance/infrastructure/attendance-log.repository";
import type { AttendanceStatus } from "@/infrastructure/db/schema";

/**
 * `markAttendance` — the write half of the staff-attendance capability
 * (spec "Daily check-in states"). ANY authenticated staff member (admin or
 * colaborador) may call this — it uses `requireSession()`, NOT
 * `requireRole()`, because there is no reason to role-gate marking one's
 * OWN presence. The staff member is derived from the session itself
 * (`session.user.id`), NEVER from a caller-supplied `staffId` parameter —
 * that would let any authenticated caller spoof marking someone else's
 * attendance. EXPLICITLY NOT tied to any pay/payroll calculation (spec) —
 * this function computes nothing beyond persisting a status.
 */
export async function markAttendance(status: AttendanceStatus, date: Date = new Date()) {
  const session = await requireSession();
  const userId = session.user.id;

  // Defensive invariant, not a real-world branch: `requireSession()`
  // already guarantees an authenticated session (redirecting otherwise),
  // and `session.user.id` is always populated from `token.sub` (see
  // auth.config.ts). The TS type is optional only because it is inherited
  // from Auth.js's own `DefaultUser.id?: string`.
  if (!userId) {
    throw new Error("Authenticated session is missing a user id.");
  }

  return upsertAttendanceLog({
    userId,
    date: normalizeAttendanceDate(date),
    status,
  });
}
