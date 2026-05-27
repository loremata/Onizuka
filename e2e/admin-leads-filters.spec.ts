import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/** Titolo lead seed (`prisma/seed.ts` + `SEED_LEAD_DEMO`). */
const SEED_LEAD_TITLE = "Lead demo — contatto sito";

test.describe("CRM · filtri lead", () => {
  test("filtro per stato QUALIFIED mostra il lead seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/crm/leads?status=QUALIFIED");

    await expect(page.getByRole("cell", { name: SEED_LEAD_TITLE })).toBeVisible({ timeout: 20_000 });
  });

  test("ricerca testuale restringe l'elenco", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/crm/leads?q=contatto%20sito");

    await expect(page.getByRole("cell", { name: SEED_LEAD_TITLE })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });
});
