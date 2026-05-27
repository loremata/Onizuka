import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("CRM · ricerca clienti", () => {
  test("parametro q su referente seed mostra Demo Client", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/clients?q=Laura");

    await expect(page.getByRole("cell", { name: "Demo Client Co", exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("parametro q senza risultati mostra messaggio dedicato", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/clients?q=__no_clients_match_e2e__");

    await expect(
      page.getByText("Nessun cliente corrisponde alla ricerca. Prova altre parole chiave o azzera i filtri.")
    ).toBeVisible({ timeout: 20_000 });
  });
});
