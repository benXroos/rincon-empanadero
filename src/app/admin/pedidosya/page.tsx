import { revalidatePath } from "next/cache";
import { listPyaDailyEstimates } from "@/features/pedidosya-reconciliation/infrastructure/pya-reconciliation.repository";
import { registerPyaDailyEstimate } from "@/features/pedidosya-reconciliation/application/register-pya-daily-estimate";
import type { PyaPaymentMethod } from "@/infrastructure/db/schema";

const PAYMENT_METHOD_LABELS: Record<PyaPaymentMethod, string> = {
  paid_in_app: "Pago en la app (PedidosYa cobra)",
  cash_collected_by_store: "Cobrado por el local (efectivo hoy)",
};

/**
 * Minimal Stage 1 admin-facing entry page (spec "Manual reconciliation
 * entry", refined by pedidosya-reconciliation-design) — just enough UI to
 * make `registerPyaDailyEstimate` end-to-end testable, NOT the metrics
 * dashboard (Phase 10 builds that; it will call
 * `listPyaDailyEstimatesInRange` directly). Both admin and colaborador may
 * VIEW and register here (gated by the shared `/admin` layout's
 * any-authenticated-session check, same as `/admin/purchases`) — the
 * mutating form is gated by `registerPyaDailyEstimate`'s own
 * `requireRole(["admin", "colaborador"])` call.
 */
export default async function PedidosYaDailyEstimatesPage() {
  const estimates = await listPyaDailyEstimates();

  return (
    <main>
      <h1>PedidosYa — estimación diaria</h1>
      <p>
        Registrá cada pedido de PedidosYa a medida que llega: monto bruto y si PedidosYa lo cobró en
        la app o si el local cobró en efectivo. El sistema estima cuánto entra HOY a la caja y
        cuánto se va a quedar el local después de la comisión — son dos números distintos.
      </p>

      <form action={handleRegisterEstimate}>
        <label>
          Número de pedido
          <input name="orderNumber" required />
        </label>
        <label>
          Monto bruto
          <input name="grossAmount" required />
        </label>
        <label>
          Forma de pago
          <select name="paymentMethod" required defaultValue="paid_in_app">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha del pedido
          <input name="orderDate" type="date" required />
        </label>
        <button type="submit">Registrar estimación</button>
      </form>

      <h2>Estimaciones registradas</h2>
      <ul>
        {estimates.map((estimate) => (
          <li key={estimate.id}>
            #{estimate.orderNumber} — {new Date(estimate.orderDate).toLocaleDateString("es-AR")} —{" "}
            {PAYMENT_METHOD_LABELS[estimate.paymentMethod]} — caja hoy: ${estimate.cashInTillToday}{" "}
            — neto estimado: ${estimate.estimatedNetKept}
          </li>
        ))}
      </ul>
    </main>
  );
}

async function handleRegisterEstimate(formData: FormData) {
  "use server";
  await registerPyaDailyEstimate({
    orderNumber: String(formData.get("orderNumber") ?? ""),
    grossAmount: String(formData.get("grossAmount") ?? "0"),
    paymentMethod: String(formData.get("paymentMethod") ?? "paid_in_app") as PyaPaymentMethod,
    orderDate: new Date(String(formData.get("orderDate") ?? "")),
  });
  revalidatePath("/admin/pedidosya");
}
