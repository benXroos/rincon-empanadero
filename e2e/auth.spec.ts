import { config } from "dotenv";

config({ path: ".env.local" });

import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/infrastructure/db/client";
import { users, products, flavors } from "@/infrastructure/db/schema";

/**
 * Phase 4 (access-control), task 4.3: real login-flow E2E coverage. Skips
 * entirely without a reachable DATABASE_URL (same `describe.skipIf` spirit
 * as the Vitest integration tests — see
 * `product-catalog.repository.integration.test.ts`), since it needs real
 * fixture users and a real product/flavor to exercise the admin-only
 * toggleAvailability action end to end.
 *
 * Fixture users are the same idempotent upsert `scripts/seed-admin.ts`
 * uses (see `sdd/rincon-empanadero-management-app/apply-progress`, Phase 4
 * batch, for how they were first created against the real Neon DB).
 */
const ADMIN_EMAIL = "e2e-admin@rinconempanadero.test";
const COLABORADOR_EMAIL = "e2e-colaborador@rinconempanadero.test";
const PASSWORD = "E2eTest1234!";
const FLAVOR_NAME = "E2E Sabor (fixture)";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.skip(!process.env.DATABASE_URL, "No DATABASE_URL reachable — skipping auth E2E.");

  const db = getDb();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  for (const [email, role] of [
    [ADMIN_EMAIL, "admin"],
    [COLABORADOR_EMAIL, "colaborador"],
  ] as const) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      await db.update(users).set({ passwordHash, role }).where(eq(users.id, existing.id));
    } else {
      await db.insert(users).values({ name: "E2E Fixture", email, passwordHash, role });
    }
  }

  let [product] = await db
    .select()
    .from(products)
    .where(eq(products.name, "E2E Producto (fixture)"));
  if (!product) {
    [product] = await db.insert(products).values({ name: "E2E Producto (fixture)" }).returning();
  }

  const [existingFlavor] = await db.select().from(flavors).where(eq(flavors.name, FLAVOR_NAME));
  if (existingFlavor) {
    await db.update(flavors).set({ isAvailable: true }).where(eq(flavors.id, existingFlavor.id));
  } else {
    await db.insert(flavors).values({
      productId: product.id,
      name: FLAVOR_NAME,
      costoMateriales: "100.0000",
      isAvailable: true,
    });
  }
});

async function logIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("an unauthenticated visitor is redirected from /admin/catalog to /login", async ({ page }) => {
  await page.goto("/admin/catalog");

  await expect(page).toHaveURL(/\/login/);
});

test("a colaborador can log in and view the catalog, but a toggle-availability attempt is denied server-side", async ({
  page,
}) => {
  await logIn(page, COLABORADOR_EMAIL);

  await expect(page).toHaveURL(/\/admin\/catalog/);
  await expect(page.getByRole("heading", { name: "Catálogo" })).toBeVisible();

  const flavorRow = page.getByRole("listitem").filter({ hasText: FLAVOR_NAME });
  await expect(flavorRow).toBeVisible();

  const toggleButton = flavorRow.getByRole("button", { name: "Marcar no disponible" });
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.request().method() === "POST"),
    toggleButton.click(),
  ]);

  expect(response.status()).toBeGreaterThanOrEqual(400);

  const db = getDb();
  const [flavorAfter] = await db.select().from(flavors).where(eq(flavors.name, FLAVOR_NAME));
  expect(flavorAfter.isAvailable).toBe(true);
});

test("an admin can log in and successfully toggle the fixture flavor's availability", async ({
  page,
}) => {
  await logIn(page, ADMIN_EMAIL);

  await expect(page).toHaveURL(/\/admin\/catalog/);

  const flavorRow = page.getByRole("listitem").filter({ hasText: FLAVOR_NAME });
  await flavorRow.getByRole("button", { name: "Marcar no disponible" }).click();
  await expect(
    page.getByText(`${FLAVOR_NAME} — costo materiales: 100.0000 — no disponible`),
  ).toBeVisible();

  const db = getDb();
  const [flavorAfter] = await db.select().from(flavors).where(eq(flavors.name, FLAVOR_NAME));
  expect(flavorAfter.isAvailable).toBe(false);
});
