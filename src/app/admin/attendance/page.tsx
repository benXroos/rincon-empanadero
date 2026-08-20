import { revalidatePath } from "next/cache";
import { requireSession } from "@/core/auth/require-role.server";
import { markAttendance } from "@/features/staff-attendance/application/mark-attendance";
import { listAttendanceInRange } from "@/features/staff-attendance/application/list-attendance";
import type { AttendanceStatus } from "@/infrastructure/db/schema";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  presente: "Presente",
  ausente: "Ausente",
  llego_tarde: "Llegó tarde",
};

const RANGE_DAYS = 7;

/**
 * Minimal staff-attendance check-in page (spec "Daily check-in states") —
 * three big buttons (the old system's "big touch buttons" spirit), one per
 * status, wired to `markAttendance`. Reachable by BOTH admin and colaborador
 * via the shared `/admin` layout's any-authenticated-session gate — marking
 * attendance is intentionally NOT role-gated (any staff member marks their
 * OWN attendance; `markAttendance` derives who from the session, no form
 * field for it). The list below reuses `listAttendanceInRange`'s own access
 * boundary: an admin sees every staff member's last week, a colaborador sees
 * only their own — enforced server-side inside `listAttendanceInRange`
 * itself, not by anything in this page.
 *
 * This is NOT the Phase 10 metrics dashboard, just enough UI to make the
 * write path (and the already-tested read boundary) end-to-end testable.
 */
export default async function AttendancePage() {
  const session = await requireSession();

  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - RANGE_DAYS);

  const records = await listAttendanceInRange(rangeStart, today);

  return (
    <main>
      <h1>Asistencia</h1>
      <p>
        Hola, {session.user.name ?? session.user.email} ({session.user.role})
      </p>

      <section>
        <h2>Marcar mi asistencia de hoy</h2>
        <form action={handleMarkPresente}>
          <button type="submit">Presente</button>
        </form>
        <form action={handleMarkAusente}>
          <button type="submit">Ausente</button>
        </form>
        <form action={handleMarkLlegoTarde}>
          <button type="submit">Llegó tarde</button>
        </form>
      </section>

      <section>
        <h2>
          {session.user.role === "admin"
            ? `Asistencia de todo el personal (últimos ${RANGE_DAYS} días)`
            : `Mi asistencia (últimos ${RANGE_DAYS} días)`}
        </h2>
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              {record.userId} — {STATUS_LABELS[record.status]} —{" "}
              {new Date(record.date).toLocaleDateString("es-AR")}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

async function handleMarkPresente() {
  "use server";
  await markAttendance("presente");
  revalidatePath("/admin/attendance");
}

async function handleMarkAusente() {
  "use server";
  await markAttendance("ausente");
  revalidatePath("/admin/attendance");
}

async function handleMarkLlegoTarde() {
  "use server";
  await markAttendance("llego_tarde");
  revalidatePath("/admin/attendance");
}
