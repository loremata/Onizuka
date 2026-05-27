import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const SEED_OPPORTUNITY_TITLE = "Restyling sito web";

test.describe("CRM · opportunità ricerca q", () => {
  test("ricerca per nome cliente mostra opportunità seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/crm/opportunities?q=Demo%20Client");

    await expect(page.getByText(SEED_OPPORTUNITY_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
