import { auth } from "@/core/auth/auth";
import { importPyaSettlement } from "@/features/pedidosya-reconciliation/application/import-pya-settlement";

/**
 * Stage 2 admin-only page: upload PedidosYa's real settlement Excel file
 * and see the variance report (spec "Settlement variance calculation",
 * refined by pedidosya-reconciliation-design). ADMIN-ONLY at the UI level
 * too (not just inside `importPyaSettlement`'s own `requireRole(["admin"])`
 * call) — this page shows financial reconciliation data a colaborador has
 * no need to see, unlike `/admin/pedidosya`'s day-to-day entry form which
 * both roles use.
 *
 * The report distinguishes matched / mismatch / no-estimate-found orders
 * PER ORDER, plus which Stage 1 estimates had no settlement row in this
 * batch — per the owner's explicit ask to see exactly which orders need
 * attention, not just an aggregate total.
 */
export default async function PedidosYaReconciliationPage() {
  const session = await auth();

  if (session?.user?.role !== "admin") {
    return (
      <main>
        <h1>PedidosYa — reconciliación</h1>
        <p>Esta sección es solo para administradores.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>PedidosYa — reconciliación</h1>
      <p>
        Subí el archivo de estado de cuenta real de PedidosYa (~2 semanas después de los pedidos)
        para comparar contra las estimaciones diarias registradas.
      </p>

      <form action={handleImportSettlement}>
        <label>
          Archivo de estado de cuenta (.xls/.xlsx)
          <input name="settlementFile" type="file" accept=".xls,.xlsx" required />
        </label>
        <button type="submit">Importar y comparar</button>
      </form>
    </main>
  );
}

async function handleImportSettlement(formData: FormData) {
  "use server";
  const file = formData.get("settlementFile");
  if (!(file instanceof File)) {
    return;
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  await importPyaSettlement(buffer);
}
