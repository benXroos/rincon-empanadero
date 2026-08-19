import { revalidatePath } from "next/cache";
import {
  listProducts,
  listFlavorsByProduct,
  listPacks,
} from "@/features/product-catalog/infrastructure/product-catalog.repository";
import { createProduct } from "@/features/product-catalog/application/create-product";
import { createFlavor } from "@/features/product-catalog/application/create-flavor";
import { createPack } from "@/features/product-catalog/application/create-pack";
import { toggleAvailability } from "@/features/product-catalog/application/toggle-availability";

/**
 * Minimal admin-facing catalog management page (spec/task 3.3: "Admin CRUD
 * server actions + list UI for products/flavors/packs"). Both admin and
 * colaborador may VIEW (spec access-control permission table: "View
 * availability/inventory: Yes, read-only for colaborador") — only the
 * mutating server actions below are admin-gated, each via its own
 * requireRole(["admin"]) call (already unit-tested per action).
 *
 * Phase 4 (access-control): the view-access gate that used to live here
 * directly (`requireRole(["admin", "colaborador"])`) has moved up to the
 * shared `src/app/admin/layout.tsx`, which now covers every `/admin/*`
 * route and redirects an unauthenticated visitor to `/login` instead of
 * throwing an unhandled error — this page no longer needs its own check.
 */
export default async function CatalogAdminPage() {
  const products = await listProducts();
  const productsWithFlavors = await Promise.all(
    products.map(async (product) => ({
      product,
      flavors: await listFlavorsByProduct(product.id),
    })),
  );
  const packs = await listPacks();

  return (
    <main>
      <h1>Catálogo</h1>

      <section>
        <h2>Productos y sabores</h2>
        {productsWithFlavors.map(({ product, flavors }) => (
          <article key={product.id}>
            <h3>{product.name}</h3>
            <ul>
              {flavors.map((flavor) => (
                <li key={flavor.id}>
                  {flavor.name} — costo materiales: {flavor.costoMateriales} —{" "}
                  {flavor.isAvailable ? "disponible" : "no disponible"}
                  <form action={handleToggleAvailability}>
                    <input type="hidden" name="flavorId" value={flavor.id} />
                    <input type="hidden" name="isAvailable" value={String(!flavor.isAvailable)} />
                    <button type="submit">
                      {flavor.isAvailable ? "Marcar no disponible" : "Marcar disponible"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={handleCreateFlavor}>
              <input type="hidden" name="productId" value={product.id} />
              <label>
                Sabor
                <input name="name" required />
              </label>
              <label>
                Costo materiales
                <input name="costoMateriales" required />
              </label>
              <button type="submit">Agregar sabor</button>
            </form>
          </article>
        ))}

        <form action={handleCreateProduct}>
          <label>
            Nuevo producto
            <input name="name" required />
          </label>
          <button type="submit">Crear producto</button>
        </form>
      </section>

      <section>
        <h2>Packs</h2>
        <ul>
          {packs.map((pack) => (
            <li key={pack.id}>
              {pack.name} — {pack.unitCount} unidades
            </li>
          ))}
        </ul>
        <form action={handleCreatePack}>
          <label>
            Nombre
            <input name="name" required />
          </label>
          <label>
            Unidades
            <input name="unitCount" type="number" required />
          </label>
          <button type="submit">Crear pack</button>
        </form>
      </section>
    </main>
  );
}

async function handleCreateProduct(formData: FormData) {
  "use server";
  await createProduct({ name: String(formData.get("name") ?? "") });
  revalidatePath("/admin/catalog");
}

async function handleCreateFlavor(formData: FormData) {
  "use server";
  await createFlavor({
    productId: String(formData.get("productId") ?? ""),
    name: String(formData.get("name") ?? ""),
    costoMateriales: String(formData.get("costoMateriales") ?? ""),
  });
  revalidatePath("/admin/catalog");
}

async function handleCreatePack(formData: FormData) {
  "use server";
  await createPack({
    name: String(formData.get("name") ?? ""),
    unitCount: Number(formData.get("unitCount") ?? 0),
  });
  revalidatePath("/admin/catalog");
}

async function handleToggleAvailability(formData: FormData) {
  "use server";
  await toggleAvailability({
    flavorId: String(formData.get("flavorId") ?? ""),
    isAvailable: formData.get("isAvailable") === "true",
  });
  revalidatePath("/admin/catalog");
}
