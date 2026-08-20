import { describe, expect, it } from "vitest";
import { normalizeAttendanceDate } from "@/features/staff-attendance/domain/normalize-attendance-date";

/**
 * staff-attendance capability (spec "Daily check-in states"): attendance is
 * ONE record per user per day, so any two timestamps within the same
 * calendar day (UTC) must normalize to the exact same date value — this is
 * what makes the repository's upsert-by-(userId, date) unique constraint
 * behave correctly regardless of what time of day a check-in happens.
 */
describe("normalizeAttendanceDate", () => {
  it("strips the time-of-day, returning UTC midnight for a morning timestamp", () => {
    const result = normalizeAttendanceDate(new Date("2026-08-10T08:15:00Z"));

    expect(result.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("normalizes a different time on the SAME day to the SAME date (triangulation)", () => {
    const morning = normalizeAttendanceDate(new Date("2026-08-10T08:15:00Z"));
    const evening = normalizeAttendanceDate(new Date("2026-08-10T23:59:59Z"));

    expect(evening.toISOString()).toBe(morning.toISOString());
  });

  it("normalizes a DIFFERENT day to a DIFFERENT date (triangulation)", () => {
    const day1 = normalizeAttendanceDate(new Date("2026-08-10T23:59:59Z"));
    const day2 = normalizeAttendanceDate(new Date("2026-08-11T00:00:01Z"));

    expect(day1.toISOString()).not.toBe(day2.toISOString());
    expect(day2.toISOString()).toBe("2026-08-11T00:00:00.000Z");
  });
});
