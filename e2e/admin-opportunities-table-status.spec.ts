import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

const SEED_OPPORTUNITY_TITLE = "Restyling sito web";

test.describe("CRM · opportunità tabella stato rapido", () => {
  test("sposta stato dalla tabella e ripristina", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/crm/opportunities");

    const row = page.locator("tr").filter({ hasText: SEED_OPPORTUNITY_TITLE }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });

    const form = row.locator("form").first();
    await form.locator('select[name="status"]').selectOption("PAUSED");
    await form.getByRole("button", { name: "Sposta" }).click();
    await expect(form.locator(".text-destructive")).toHaveCount(0);

    await expect(row.locator('select[name="status"]')).toHaveValue("PAUSED", { timeout: 20_000 });

    await form.locator('select[name="status"]').selectOption("OPEN");
    await form.getByRole("button", { name: "Sposta" }).click();
    await expect(row.locator('select[name="status"]')).toHaveValue("OPEN", { timeout: 20_000 });
  });
});
