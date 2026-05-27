import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Ricerca globale · opportunità per cliente", () => {
  test("query sul nome cliente mostra opportunità seed nella sezione Opportunità", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/search?q=Demo%20Client");

    await expect(page.getByRole("heading", { name: "Opportunità" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Restyling sito web", { exact: true }).first()).toBeVisible();
  });
});
