import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Utenti · filtri GET", () => {
  test("ruolo ADMIN e testo agency mostra l'admin seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/users?role=ADMIN&q=agency");

    await expect(page.getByRole("cell", { name: "admin@agency.com", exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
