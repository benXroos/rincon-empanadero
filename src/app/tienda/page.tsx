import {
  browseAvailableFlavors,
  browsePacks,
  browsePackFlavorOptions,
} from "@/features/online-storefront/application/browse-catalog";
import { CheckoutForm } from "@/app/tienda/checkout-form";

/**
 * Public storefront page (spec capability "online-storefront") — the first
 * customer-facing route in this project, deliberately separate from `/`
 * (kept as the Phase 1 scaffold home page + smoke test) so this page can
 * evolve independently. No `requireRole`/`requireSession` — anonymous,
 * same as every function it calls.
 *
 * `force-dynamic` is required, not just a nicety: this page has no
 * cookies/headers usage, so Next.js would otherwise statically prerender it
 * at BUILD time — which would silently violate the spec scenario "Toggle
 * hides from storefront" (an availability change must apply "immediately
 * ... storefront-wide", not only after the next rebuild/deploy).
 */
export const dynamic = "force-dynamic";

export default async function TiendaPage() {
  const [flavors, packs] = await Promise.all([browseAvailableFlavors(), browsePacks()]);

  const packsWithOptions = await Promise.all(
    packs.map(async (pack) => ({
      pack,
      flavorOptions: await browsePackFlavorOptions(pack.id),
    })),
  );

  return (
    <main>
      <h1>Rincón Empanadero — Tienda</h1>

      <section>
        <h2>Catálogo</h2>
        <ul>
          {flavors.map((flavor) => (
            <li key={flavor.id}>{flavor.name}</li>
          ))}
        </ul>
        {packsWithOptions.map(({ pack, flavorOptions }) => (
          <div key={pack.id}>
            <h3>
              {pack.name} ({pack.unitCount} unidades)
            </h3>
            <ul>
              {flavorOptions.map((flavor) => (
                <li key={flavor.id}>{flavor.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <CheckoutForm
        flavors={flavors.map((flavor) => ({ id: flavor.id, name: flavor.name }))}
        packs={packsWithOptions.map(({ pack, flavorOptions }) => ({
          id: pack.id,
          name: pack.name,
          unitCount: pack.unitCount,
          flavorOptions: flavorOptions.map((flavor) => ({ id: flavor.id, name: flavor.name })),
        }))}
      />
    </main>
  );
}
