import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin · catalogo asset", () => {
  test("creazione asset dalla scheda cliente demo", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/clients");

    await page.getByRole("row", { name: /Demo Client Co/ }).getByRole("link", { name: "Scheda" }).click();
    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+$/);

    await page.getByRole("link", { name: "Aggiungi asset" }).first().click();
    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+\/assets\/new$/);

    const label = `E2E asset ${Date.now()}`;
    await page.getByLabel("Nome asset").fill(label);
    await page.getByRole("button", { name: "Crea asset" }).click();

    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+$/);
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  });
});
