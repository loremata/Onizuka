import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin · conversione lead → cliente", () => {
  test("crea lead e lo converte in cliente CRM", async ({ page }) => {
    const stamp = Date.now();
    const title = `E2E lead convert ${stamp}`;
    const businessName = `E2E Biz ${stamp}`;
    const email = `e2e.lead.${stamp}@example.test`;

    await loginAsAdmin(page);

    await page.goto("/admin/crm/leads/new");
    await expect(page.getByRole("heading", { name: "Nuovo lead" })).toBeVisible();

    await page.getByLabel("Titolo lead").fill(title);
    await page.getByLabel("Ragione sociale presunta").fill(businessName);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Nome contatto").fill("E2E Contatto");
    await page.getByRole("button", { name: "Crea lead" }).click();

    await expect(page).toHaveURL(/\/admin\/crm\/leads$/);

    await page.getByRole("row", { name: new RegExp(title) }).getByRole("link", { name: "Modifica" }).click();
    await expect(page).toHaveURL(/\/admin\/crm\/leads\/[^/]+\/edit$/);

    await page.getByRole("link", { name: "Converti in cliente" }).click();
    await expect(page).toHaveURL(/\/admin\/crm\/leads\/[^/]+\/convert$/);

    await expect(page.getByRole("heading", { name: "Converti in cliente" })).toBeVisible();
    await expect(page.getByLabel("Ragione sociale")).toHaveValue(businessName);
    await expect(page.getByLabel("Email di contatto")).toHaveValue(email);

    await page.getByLabel("Slug").fill(`e2e-client-${stamp}`);
    await page.getByRole("button", { name: "Crea cliente e collega lead" }).click();

    await expect(page).toHaveURL(/\/admin\/clients\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: businessName })).toBeVisible();
    await expect(page.getByText(/Convertito da lead/)).toBeVisible();
  });
});
