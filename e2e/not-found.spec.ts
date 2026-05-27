import { test, expect } from "@playwright/test";

test.describe("404", () => {
  test("percorso sconosciuto mostra pagina non trovata in italiano", async ({ page }) => {
    await page.goto("/percorso-inesistente-e2e-404");
    await expect(page.getByRole("heading", { name: "Pagina non trovata" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Accedi" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vai alla home" })).toBeVisible();
  });
});
