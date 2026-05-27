import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin · referenti cliente", () => {
  test("creazione referente da scheda demo", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/clients");

    await page.getByRole("row", { name: /Demo Client Co/ }).getByRole("link", { name: "Scheda" }).click();
    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+$/);

    await page.getByRole("link", { name: "Gestisci referenti" }).first().click();
    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+\/contacts$/);

    const name = `E2E referente ${Date.now()}`;
    await page.getByLabel("Nome", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Aggiungi referente" }).click();

    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+\/contacts$/);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
});
