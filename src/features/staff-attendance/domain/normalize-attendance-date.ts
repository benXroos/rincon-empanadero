/**
 * staff-attendance capability (spec "Daily check-in states"): pure, no I/O.
 * Attendance is ONE record per user per calendar day (UTC) — this function
 * strips the time-of-day so `mark-attendance.ts` and the repository's
 * unique-by-(userId, date) upsert always key off the same day value no
 * matter what time a check-in happens.
 */
export function normalizeAttendanceDate(timestamp: Date): Date {
  return new Date(
    Date.UTC(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()),
  );
}
