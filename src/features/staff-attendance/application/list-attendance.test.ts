import { describe, expect, it, vi, beforeEach } from "vitest";

const { requireSessionMock, listAttendanceLogsInRangeMock, listAttendanceLogsInRangeForUserMock } =
  vi.hoisted(() => ({
    requireSessionMock: vi.fn(),
    listAttendanceLogsInRangeMock: vi.fn(),
    listAttendanceLogsInRangeForUserMock: vi.fn(),
  }));

vi.mock("@/core/auth/require-role.server", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/features/staff-attendance/infrastructure/attendance-log.repository", () => ({
  listAttendanceLogsInRange: listAttendanceLogsInRangeMock,
  listAttendanceLogsInRangeForUser: listAttendanceLogsInRangeForUserMock,
}));

const { listAttendanceInRange } =
  await import("@/features/staff-attendance/application/list-attendance");

const START = new Date("2026-08-10T00:00:00Z");
const END = new Date("2026-08-17T00:00:00Z");

/**
 * `listAttendanceInRange` — the read half of staff-attendance. Access
 * boundary (simplest MVP shape, per the explicit permission model): admin
 * sees ALL staff's records in the range; a colaborador sees only their OWN
 * (self-view unrestricted, view-others admin-only). Feeds Phase 10's
 * dashboard directly for the admin case; no UI beyond this batch's own
 * check-in page needs the colaborador case yet, but the query exists per
 * the explicit scope instruction.
 */
describe("listAttendanceInRange (admin sees all, colaborador sees only their own)", () => {
  beforeEach(() => {
    requireSessionMock.mockReset();
    listAttendanceLogsInRangeMock.mockReset();
    listAttendanceLogsInRangeForUserMock.mockReset();
  });

  it("returns ALL staff's records for an admin caller", async () => {
    requireSessionMock.mockResolvedValueOnce({ user: { id: "admin-1", role: "admin" } });
    listAttendanceLogsInRangeMock.mockResolvedValueOnce([
      { id: "log-1", userId: "user-a" },
      { id: "log-2", userId: "user-b" },
    ]);

    const result = await listAttendanceInRange(START, END);

    expect(listAttendanceLogsInRangeMock).toHaveBeenCalledWith(START, END);
    expect(listAttendanceLogsInRangeForUserMock).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("returns only the CALLER's own records for a colaborador (triangulation on role)", async () => {
    requireSessionMock.mockResolvedValueOnce({ user: { id: "user-c", role: "colaborador" } });
    listAttendanceLogsInRangeForUserMock.mockResolvedValueOnce([{ id: "log-3", userId: "user-c" }]);

    const result = await listAttendanceInRange(START, END);

    expect(listAttendanceLogsInRangeForUserMock).toHaveBeenCalledWith("user-c", START, END);
    expect(listAttendanceLogsInRangeMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: "log-3", userId: "user-c" }]);
  });

  it("denies an unauthenticated caller and never touches either repository query", async () => {
    requireSessionMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(listAttendanceInRange(START, END)).rejects.toThrow("NEXT_REDIRECT");

    expect(listAttendanceLogsInRangeMock).not.toHaveBeenCalled();
    expect(listAttendanceLogsInRangeForUserMock).not.toHaveBeenCalled();
  });
});
