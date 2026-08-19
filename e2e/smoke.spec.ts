import { test, expect } from "@playwright/test";

/**
 * Proves the Playwright toolchain runs against a real dev server before
 * any feature E2E work starts (role-gated flows land in Phase 4).
 */
test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rincón Empanadero" })).toBeVisible();
});
