"use server";

import { requireSession } from "@/core/auth/require-role.server";
import {
  listAttendanceLogsInRange,
  listAttendanceLogsInRangeForUser,
} from "@/features/staff-attendance/infrastructure/attendance-log.repository";

/**
 * `listAttendanceInRange` — the read half of staff-attendance. Access
 * boundary (simplest MVP shape, per the explicit permission model for this
 * capability): admin sees ALL staff's records in the range (Phase 10's
 * dashboard will call this directly); a colaborador sees only their OWN
 * records (self-view unrestricted — viewing ANOTHER staff member's record
 * stays admin-only, enforced here by branching on role rather than trusting
 * a caller-supplied userId).
 */
export async function listAttendanceInRange(start: Date, end: Date) {
  const session = await requireSession();

  if (session.user.role === "admin") {
    return listAttendanceLogsInRange(start, end);
  }

  const userId = session.user.id;

  // Defensive invariant — see mark-attendance.ts's identical comment.
  if (!userId) {
    throw new Error("Authenticated session is missing a user id.");
  }

  return listAttendanceLogsInRangeForUser(userId, start, end);
}
