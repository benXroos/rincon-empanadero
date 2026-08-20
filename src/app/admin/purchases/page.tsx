import { revalidatePath } from "next/cache";
import {
  listProducts,
  listFlavorsByProduct,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";
import {
  listPurchaseLogs,
  listDecomisoLogs,
} from "@/features/purchase-expense-log/infrastructure/purchase-expense-log.repository";
import { registerPurchase } from "@/features/purchase-expense-log/application/register-purchase";
import { registerDecomiso } from "@/features/purchase-expense-log/application/register-decomiso";
import type { PurchaseCategory } from "@/infrastructure/db/schema";

const CATEGORY_LABELS: Record<PurchaseCategory, string> = {
  proteins_dairy: "Proteínas / lácteos",
  produce: "Verdulería",
  prepared_fillings: "Rellenos preparados",
  packaging: "Empaque",
  supplies: "Insumos",
};

/**
 * Minimal admin-facing purchase/decomiso log page (spec "Weekly
 * purchase/expense registration" + waste/decomiso-by-flavor, mvp-decisions
 * #10) — just enough UI to make the write path (`registerPurchase`/
 * `registerDecomiso`) end-to-end testable, NOT the metrics dashboard
 * (Phase 10 builds that; it will call this capability's date-range queries
 * directly). Both admin and colaborador may VIEW this page (gated by the
 * shared `/admin` layout's any-authenticated-session check, same as
 * `/admin/catalog`) — only the mutating forms below are admin-gated, each
 * via its own `requireRole(["admin"])` call inside `registerPurchase`/
 * `registerDecomiso` (already unit-tested per action).
 */
export default async function PurchasesAdminPage() {
  const [purchaseLogs, decomisoLogs, products] = await Promise.all([
    listPurchaseLogs(),
    listDecomisoLogs(),
    listProducts(),
  ]);

  const flavorsByProduct = await Promise.all(
    products.map(async (product) => ({
      product,
      flavors: await listFlavorsByProduct(product.id),
    })),
  );

  return (
    <main>
      <h1>Compras y decomiso</h1>

      <section>
        <h2>Registrar compra</h2>
        <form action={handleRegisterPurchase}>
          <label>
            Ítem
            <input name="itemName" required />
          </label>
          <label>
            Categoría
            <select name="category" required defaultValue="supplies">
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cantidad
            <input name="quantity" required />
          </label>
          <label>
            Precio unitario
            <input name="unitPrice" required />
          </label>
          <label>
            Fecha de compra
            <input name="purchaseDate" type="date" required />
          </label>
          <button type="submit">Registrar compra</button>
        </form>

        <h3>Compras registradas</h3>
        <ul>
          {purchaseLogs.map((log) => (
            <li key={log.id}>
              {log.itemName} — {CATEGORY_LABELS[log.category]} — {log.quantity} × {log.unitPrice} ={" "}
              {log.totalCost} — {new Date(log.purchaseDate).toLocaleDateString("es-AR")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Registrar decomiso</h2>
        <form action={handleRegisterDecomiso}>
          <label>
            Sabor
            <select name="flavorId" required>
              {flavorsByProduct.flatMap(({ flavors }) =>
                flavors.map((flavor) => (
                  <option key={flavor.id} value={flavor.id}>
                    {flavor.name}
                  </option>
                )),
              )}
            </select>
          </label>
          <label>
            Cantidad desechada
            <input name="quantityWasted" required />
          </label>
          <label>
            Fecha
            <input name="wasteDate" type="date" required />
          </label>
          <label>
            Motivo (opcional)
            <input name="reason" />
          </label>
          <button type="submit">Registrar decomiso</button>
        </form>

        <h3>Decomiso registrado</h3>
        <ul>
          {decomisoLogs.map((log) => (
            <li key={log.id}>
              {log.flavorId} — {log.quantityWasted} —{" "}
              {new Date(log.wasteDate).toLocaleDateString("es-AR")}
              {log.reason ? ` — ${log.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

async function handleRegisterPurchase(formData: FormData) {
  "use server";
  await registerPurchase({
    itemName: String(formData.get("itemName") ?? ""),
    category: String(formData.get("category") ?? "supplies") as PurchaseCategory,
    quantity: String(formData.get("quantity") ?? "0"),
    unitPrice: String(formData.get("unitPrice") ?? "0"),
    purchaseDate: new Date(String(formData.get("purchaseDate") ?? "")),
  });
  revalidatePath("/admin/purchases");
}

async function handleRegisterDecomiso(formData: FormData) {
  "use server";
  const reason = String(formData.get("reason") ?? "").trim();
  await registerDecomiso({
    flavorId: String(formData.get("flavorId") ?? ""),
    quantityWasted: String(formData.get("quantityWasted") ?? "0"),
    wasteDate: new Date(String(formData.get("wasteDate") ?? "")),
    reason: reason === "" ? undefined : reason,
  });
  revalidatePath("/admin/purchases");
}
