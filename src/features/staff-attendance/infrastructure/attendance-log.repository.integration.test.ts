import "@/test/load-test-env";

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { users, attendanceLogs } from "@/infrastructure/db/schema";
import {
  upsertAttendanceLog,
  listAttendanceLogsInRange,
  listAttendanceLogsInRangeForUser,
} from "@/features/staff-attendance/infrastructure/attendance-log.repository";

/**
 * Real Neon Postgres round-trip test — same
 * `import { config } from "dotenv"; config({ path: ".env.local" });` +
 * `describe.skipIf(!hasDatabase)` pattern established since Phase 3.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("attendance-log repository (live Neon integration)", () => {
  const createdUserIds: string[] = [];
  const createdAttendanceLogIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of createdAttendanceLogIds.splice(0)) {
      await db.delete(attendanceLogs).where(eq(attendanceLogs.id, id));
    }
    for (const id of createdUserIds.splice(0)) {
      await db.delete(users).where(eq(users.id, id));
    }
  });

  async function insertFixtureUser(role: "admin" | "colaborador") {
    const suffix = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [user] = await getDb()
      .insert(users)
      .values({
        name: `Fixture ${suffix}`,
        email: `${suffix}@rinconempanadero.test`,
        passwordHash: "not-a-real-hash",
        role,
      })
      .returning();
    createdUserIds.push(user.id);
    return user;
  }

  it("persists an attendance log and reads it back unchanged", async () => {
    const user = await insertFixtureUser("colaborador");

    const inserted = await upsertAttendanceLog({
      userId: user.id,
      date: new Date("2026-08-10T00:00:00Z"),
      status: "presente",
    });
    createdAttendanceLogIds.push(inserted.id);

    const sameWeek = await listAttendanceLogsInRange(
      new Date("2026-08-10T00:00:00Z"),
      new Date("2026-08-11T00:00:00Z"),
    );
    const found = sameWeek.find((row) => row.id === inserted.id);

    expect(found?.userId).toBe(user.id);
    expect(found?.status).toBe("presente");
  });

  it("upserts (overwrites) the same user+date instead of duplicating a row", async () => {
    const user = await insertFixtureUser("colaborador");

    const first = await upsertAttendanceLog({
      userId: user.id,
      date: new Date("2026-08-12T00:00:00Z"),
      status: "llego_tarde",
    });
    createdAttendanceLogIds.push(first.id);

    const second = await upsertAttendanceLog({
      userId: user.id,
      date: new Date("2026-08-12T00:00:00Z"),
      status: "presente",
    });

    expect(second.id).toBe(first.id);

    const forUser = await listAttendanceLogsInRangeForUser(
      user.id,
      new Date("2026-08-12T00:00:00Z"),
      new Date("2026-08-13T00:00:00Z"),
    );
    expect(forUser).toHaveLength(1);
    expect(forUser[0].status).toBe("presente");
  });

  it("finds an attendance log within its own week and not the following week's date range", async () => {
    const user = await insertFixtureUser("admin");

    const inserted = await upsertAttendanceLog({
      userId: user.id,
      date: new Date("2026-08-10T00:00:00Z"),
      status: "ausente",
    });
    createdAttendanceLogIds.push(inserted.id);

    const nextWeek = await listAttendanceLogsInRange(
      new Date("2026-08-17T00:00:00Z"),
      new Date("2026-08-24T00:00:00Z"),
    );
    expect(nextWeek.find((row) => row.id === inserted.id)).toBeUndefined();
  });

  it("listAttendanceLogsInRangeForUser excludes another user's records (access-boundary proof)", async () => {
    const userA = await insertFixtureUser("colaborador");
    const userB = await insertFixtureUser("colaborador");

    const logA = await upsertAttendanceLog({
      userId: userA.id,
      date: new Date("2026-08-15T00:00:00Z"),
      status: "presente",
    });
    createdAttendanceLogIds.push(logA.id);
    const logB = await upsertAttendanceLog({
      userId: userB.id,
      date: new Date("2026-08-15T00:00:00Z"),
      status: "ausente",
    });
    createdAttendanceLogIds.push(logB.id);

    const forUserA = await listAttendanceLogsInRangeForUser(
      userA.id,
      new Date("2026-08-15T00:00:00Z"),
      new Date("2026-08-16T00:00:00Z"),
    );

    expect(forUserA.map((row) => row.id)).toEqual([logA.id]);
  });
});
