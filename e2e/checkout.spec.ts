import "@/test/load-test-env";

import { test, expect } from "@playwright/test";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { products, flavors, packs, packSlots, salesOrders } from "@/infrastructure/db/schema";
import { upsertPackPriceListItem } from "@/features/product-catalog/infrastructure/product-catalog.repository";
import { upsertDiscountCode } from "@/features/online-storefront/infrastructure/storefront.repository";

/**
 * Phase 6b, task 6.4: end-to-end coverage of the FULL public checkout flow
 * (spec "Cart, discounts, shipping, fulfillment, checkout") — browse the
 * real `/tienda` page, build a mixed-flavor pack selection, apply a real
 * discount code, choose pickup + bank transfer, submit the real
 * `placeCustomerOrder` server action against the real Neon DB, and see the
 * confirmation screen with payment instructions. Skips entirely without a
 * reachable `DATABASE_URL`, same `describe.skipIf` spirit as every other
 * real-DB integration test in this project.
 *
 * Uses PICKUP (not delivery) deliberately — it exercises the full flow
 * without needing a `shipping_rates` fixture row; `domain/shipping.test.ts`
 * and `compute-checkout-total.test.ts` already cover the delivery+shipping
 * math at the unit level.
 */
const PRODUCT_NAME = "E2E Producto Checkout (fixture)";
const FLAVOR_A_NAME = "E2E Sabor Carne Checkout (fixture)";
const FLAVOR_B_NAME = "E2E Sabor Pollo Checkout (fixture)";
const PACK_NAME = "E2E Docena Checkout (fixture)";
const DISCOUNT_CODE = "E2E10CHECKOUT";

test.describe.configure({ mode: "serial" });

let packId: string;
let flavorAId: string;
let flavorBId: string;

test.beforeAll(async () => {
  test.skip(!process.env.DATABASE_URL, "No DATABASE_URL reachable — skipping checkout E2E.");

  const db = getDb();

  let [product] = await db.select().from(products).where(eq(products.name, PRODUCT_NAME));
  if (!product) {
    [product] = await db.insert(products).values({ name: PRODUCT_NAME }).returning();
  }

  async function upsertFixtureFlavor(name: string) {
    const [existing] = await db.select().from(flavors).where(eq(flavors.name, name));
    if (existing) {
      const [updated] = await db
        .update(flavors)
        .set({ isAvailable: true })
        .where(eq(flavors.id, existing.id))
        .returning();
      return updated;
    }
    const [inserted] = await db
      .insert(flavors)
      .values({ productId: product.id, name, costoMateriales: "500.0000", isAvailable: true })
      .returning();
    return inserted;
  }

  const flavorA = await upsertFixtureFlavor(FLAVOR_A_NAME);
  const flavorB = await upsertFixtureFlavor(FLAVOR_B_NAME);
  flavorAId = flavorA.id;
  flavorBId = flavorB.id;

  let [pack] = await db.select().from(packs).where(eq(packs.name, PACK_NAME));
  if (!pack) {
    [pack] = await db.insert(packs).values({ name: PACK_NAME, unitCount: 12 }).returning();
  }
  packId = pack.id;

  for (const flavorId of [flavorAId, flavorBId]) {
    const [existingSlot] = await db
      .select()
      .from(packSlots)
      .where(and(eq(packSlots.packId, packId), eq(packSlots.flavorId, flavorId)));
    if (!existingSlot) {
      await db.insert(packSlots).values({ packId, flavorId });
    }
  }

  // Pack price ($25000) is fixed and NOT the sum of its flavors' prices —
  // this is the exact Phase 3 correction; the assertion below (total
  // $22500 = $25000 × 0.9) would fail loudly if that regressed.
  await upsertPackPriceListItem(packId, "own", "25000.00");
  await upsertDiscountCode({ code: DISCOUNT_CODE, type: "percentage", value: "10", active: true });
});

test("browse, build a mixed-flavor pack, apply a discount, choose pickup + transfer, and see confirmation", async ({
  page,
}) => {
  await page.goto("/tienda");

  await expect(page.getByRole("heading", { name: "Rincón Empanadero — Tienda" })).toBeVisible();
  await expect(page.getByText(FLAVOR_A_NAME).first()).toBeVisible();
  await expect(page.getByText(PACK_NAME).first()).toBeVisible();

  // Mixed-flavor pack: 8 of one flavor + 4 of another = the pack's 12 units.
  await page.locator(`input[name="pack_${packId}_flavor_${flavorAId}"]`).fill("8");
  await page.locator(`input[name="pack_${packId}_flavor_${flavorBId}"]`).fill("4");

  await page.getByLabel("Código de descuento").fill(DISCOUNT_CODE);

  await page.getByRole("radio", { name: "Retiro en local" }).check();
  await page.getByRole("radio", { name: "Transferencia bancaria" }).check();

  await page.getByRole("button", { name: "Finalizar pedido" }).click();

  await expect(page.getByRole("heading", { name: "¡Pedido confirmado!" })).toBeVisible();
  await expect(page.getByText("Total: $22500.00")).toBeVisible();
  await expect(page.getByText(/Alias para transferir:/)).toBeVisible();

  const orderIdText = await page.getByText(/Número de pedido:/).textContent();
  const orderId = orderIdText?.replace("Número de pedido:", "").trim();
  expect(orderId).toBeTruthy();

  const db = getDb();
  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId!));

  expect(order?.channel).toBe("own");
  expect(order?.paymentMethod).toBe("transfer");
  expect(order?.fulfillmentMethod).toBe("pickup");
  expect(order?.totalAmount).toBe("22500.00");
});
