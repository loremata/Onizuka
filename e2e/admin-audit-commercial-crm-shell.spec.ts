import { test, expect } from "@playwright/test";

/**
 * Shell UI form audit digitale (senza attendere audit server completo via submit).
 * Il flusso server+CRM è in admin-audit-commercial-crm.spec.ts (fixture = stesso stack actions).
 */
test.describe("Admin · audit digitale — shell UI", () => {
  test.describe.configure({ timeout: 120_000 });
  test("form: validazione campi vuoti", async ({ page }) => {
    await page.goto("/admin/audit/digital");
    await expect(page.getByRole("heading", { name: /audit digitale/i })).toBeVisible();
    await page.getByRole("button", { name: /Avvia audit/i }).click();
    await expect(page.getByText(/P\.IVA valida|dominio\/ragione sociale/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("form: dominio-only mostra esito (messaggio o navigazione)", async ({ page }) => {
    const stamp = Date.now();
    await page.goto("/admin/audit/digital");
    await page.locator('input[name="vatNumber"]').fill("");
    await page.locator('input[name="website"]').fill(`https://solo-dominio-${stamp}.example.test`);
    await page.getByRole("button", { name: /Avvia audit/i }).click();

    const redirected = await page
      .waitForURL(/\/admin\/audit\/digital\/[^/]+$/, { timeout: 90_000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      await expect(
        page.getByText(/insufficienti|match|verifica|dominio|P\.IVA|fallito|errore/i).or(
          page.locator(`a[href*="/admin/audit/digital/"]`)
        )
      ).toBeVisible({ timeout: 15_000 });
    }
  });
});
