import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { SEED_LEAD_DEMO } from "./seed-constants";

/** Titolo lead seed (`prisma/seed.ts`). */
const SEED_LEAD_TITLE = "Lead demo — contatto sito";

test.describe("CRM · stato rapido lead", () => {
  test.describe.configure({ mode: "serial" });

  test("cambio stato dalla tabella e messaggio di conferma", async ({ page }) => {
    await loginAsAdmin(page);
    // Senza filtro stato: dopo il cambio stato il refresh non nasconde la riga.
    await page.goto("/admin/crm/leads");

    const row = page.locator("tr").filter({ hasText: SEED_LEAD_TITLE });
    await expect(row).toBeVisible({ timeout: 20_000 });

    const statusSelect = row.locator(`#lead-status-${SEED_LEAD_DEMO}`);
    await statusSelect.selectOption("CONTACTED");
    await row.getByRole("button", { name: "Sposta" }).click();

    await expect(row.getByText("Stato aggiornato.", { exact: true })).toBeVisible({ timeout: 15_000 });

    await statusSelect.selectOption("QUALIFIED");
    await row.getByRole("button", { name: "Sposta" }).click();
    await expect(row.getByText("Stato aggiornato.", { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
