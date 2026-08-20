import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { attendanceLogs, type NewAttendanceLog } from "@/infrastructure/db/schema";

/**
 * Drizzle repository for the staff-attendance capability. Holds no
 * authorization logic of its own — the calling application-layer action
 * (`application/mark-attendance.ts`/`application/list-attendance.ts`) is
 * responsible for deriving/checking the caller's identity and role, same
 * split as `purchase-expense-log.repository.ts`.
 */

/**
 * Upserts (insert-or-overwrite) the one attendance record for a given
 * `(userId, date)` — select-then-update/insert, mirroring
 * `storefront.repository.ts#upsertDiscountCode`'s exact pattern. A second
 * check-in for the same user on the same day overwrites the first row's
 * `status`/`updatedAt` rather than duplicating it (see schema.ts's
 * `attendance_logs` doc comment for why: a "llego_tarde" mark may
 * legitimately be corrected to "presente" later the same day).
 */
export async function upsertAttendanceLog(row: NewAttendanceLog) {
  const db = getDb();
  const existing = await db
    .select()
    .from(attendanceLogs)
    .where(and(eq(attendanceLogs.userId, row.userId), eq(attendanceLogs.date, row.date)));

  if (existing[0]) {
    const [updated] = await db
      .update(attendanceLogs)
      .set({ status: row.status, updatedAt: new Date() })
      .where(eq(attendanceLogs.id, existing[0].id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(attendanceLogs).values(row).returning();
  return inserted;
}

/**
 * ALL staff members' attendance within a date range — the admin/dashboard
 * view (Phase 10's metrics dashboard, or an admin "view all staff" screen).
 * No role check here — the calling application layer enforces admin-only
 * access to this specific query (colaborador gets the narrower
 * `listAttendanceLogsInRangeForUser` instead).
 */
export async function listAttendanceLogsInRange(start: Date, end: Date) {
  return getDb()
    .select()
    .from(attendanceLogs)
    .where(and(gte(attendanceLogs.date, start), lte(attendanceLogs.date, end)));
}

/**
 * ONE staff member's own attendance within a date range — the self-view
 * query a colaborador is allowed to see without any admin role.
 */
export async function listAttendanceLogsInRangeForUser(
  userId: string,
  start: Date,
  end: Date,
) {
  return getDb()
    .select()
    .from(attendanceLogs)
    .where(
      and(
        eq(attendanceLogs.userId, userId),
        gte(attendanceLogs.date, start),
        lte(attendanceLogs.date, end),
      ),
    );
}
