import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/** Titolo voce memoria seed (`prisma/seed.ts` + `SEED_MEMORY_DEMO_CLIENT`). */
const SEED_MEMORY_TITLE = "Preferenze cliente demo";

test.describe("Memory · filtri GET", () => {
  test("ricerca testuale mostra la voce seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/memory?q=Preferenze");

    await expect(page.getByText(SEED_MEMORY_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  test("filtro ambito CLIENT mostra la voce seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/memory?scope=CLIENT");

    await expect(page.getByText(SEED_MEMORY_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("ricerca per tag esatto (has) trova la voce seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/memory?q=demo");

    await expect(page.getByText(SEED_MEMORY_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
