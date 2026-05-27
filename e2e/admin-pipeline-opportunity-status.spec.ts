import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/** Titolo opportunità seed (`prisma/seed.ts` + `SEED_OPPORTUNITY_DEMO`). */
const SEED_OPPORTUNITY_TITLE = "Restyling sito web";

test.describe("CRM · pipeline stato rapido", () => {
  test("sposta opportunità seed tra colonne e ripristina", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/crm/pipeline");

    const title = page.getByText(SEED_OPPORTUNITY_TITLE, { exact: true }).first();
    await expect(title).toBeVisible({ timeout: 20_000 });

    const card = page.locator("div.rounded-md.border").filter({ hasText: SEED_OPPORTUNITY_TITLE }).first();
    await expect(card).toBeVisible();

    await card.locator('select[name="status"]').selectOption("PAUSED");
    await card.getByRole("button", { name: "Sposta" }).click();
    await expect(card.locator(".text-destructive")).toHaveCount(0);

    const pausedCol = page.getByRole("heading", { name: "In pausa" }).locator("..").locator("..");
    await expect(pausedCol.getByText(SEED_OPPORTUNITY_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });

    const cardPaused = pausedCol.locator("div.rounded-md.border").filter({ hasText: SEED_OPPORTUNITY_TITLE }).first();
    await cardPaused.locator('select[name="status"]').selectOption("OPEN");
    await cardPaused.getByRole("button", { name: "Sposta" }).click();

    const openCol = page.getByRole("heading", { name: "Aperta" }).locator("..").locator("..");
    await expect(openCol.getByText(SEED_OPPORTUNITY_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
