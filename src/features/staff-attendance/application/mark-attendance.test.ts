import { describe, expect, it, vi, beforeEach } from "vitest";

const { requireSessionMock, upsertAttendanceLogMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  upsertAttendanceLogMock: vi.fn(),
}));

vi.mock("@/core/auth/require-role.server", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/features/staff-attendance/infrastructure/attendance-log.repository", () => ({
  upsertAttendanceLog: upsertAttendanceLogMock,
}));

const { markAttendance } = await import("@/features/staff-attendance/application/mark-attendance");

/**
 * `markAttendance` marks the CALLER's own attendance, derived from the
 * session — it deliberately takes NO staffId/userId parameter, so no caller
 * can spoof marking someone else's attendance (per the explicit permission
 * model for this capability). Uses `requireSession()` (any authenticated
 * user, admin or colaborador — not `requireRole`) since there is no reason
 * to role-gate marking one's OWN presence.
 */
describe("markAttendance (any authenticated staff member, own record only)", () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    upsertAttendanceLogMock.mockReset();
  });

  it("derives the userId from the session, never from a caller-supplied param", async () => {
    requireSessionMock.mockResolvedValueOnce({
      user: { id: "user-abc", role: "colaborador" },
    });
    upsertAttendanceLogMock.mockResolvedValueOnce({
      id: "log-1",
      userId: "user-abc",
      status: "presente",
    });

    await markAttendance("presente", new Date("2026-08-10T15:30:00Z"));

    expect(upsertAttendanceLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-abc", status: "presente" }),
    );
  });

  it("normalizes the date to day-only before persisting (reuses the pure domain function)", async () => {
    requireSessionMock.mockResolvedValueOnce({
      user: { id: "user-abc", role: "colaborador" },
    });
    upsertAttendanceLogMock.mockResolvedValueOnce({ id: "log-1" });

    await markAttendance("presente", new Date("2026-08-10T23:59:00Z"));

    const call = upsertAttendanceLogMock.mock.calls[0][0];
    expect((call.date as Date).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("persists a DIFFERENT status for a DIFFERENT user's check-in (triangulation)", async () => {
    requireSessionMock.mockResolvedValueOnce({
      user: { id: "user-xyz", role: "admin" },
    });
    upsertAttendanceLogMock.mockResolvedValueOnce({ id: "log-2" });

    await markAttendance("llego_tarde", new Date("2026-08-11T09:00:00Z"));

    expect(upsertAttendanceLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-xyz", status: "llego_tarde" }),
    );
  });

  it("denies an unauthenticated caller and never touches the repository", async () => {
    requireSessionMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(markAttendance("presente")).rejects.toThrow("NEXT_REDIRECT");

    expect(upsertAttendanceLogMock).not.toHaveBeenCalled();
  });
});
