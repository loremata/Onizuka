import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";
import { SEED_OPPORTUNITY_DEMO } from "./seed-constants";

/** Titolo opportunità seed (`prisma/seed.ts`). */
const SEED_OPPORTUNITY_TITLE = "Restyling sito web";

test.describe("CRM · pipeline drag-and-drop", () => {
  test.describe.configure({ mode: "serial" });

  test("trascina opportunità seed tra colonne e ripristina", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/crm/pipeline");

    const title = page.getByText(SEED_OPPORTUNITY_TITLE, { exact: true }).first();
    await expect(title).toBeVisible({ timeout: 20_000 });

    const handle = page.locator(`[data-opp-id="${SEED_OPPORTUNITY_DEMO}"] .pipeline-drag-handle`);
    await expect(handle).toBeVisible();

    const pausedDrop = page.locator('[data-drop-status="PAUSED"]');
    await handle.dragTo(pausedDrop);

    const pausedCol = page.getByRole("heading", { name: "In pausa" }).locator("..").locator("..");
    await expect(pausedCol.getByText(SEED_OPPORTUNITY_TITLE, { exact: true })).toBeVisible({ timeout: 25_000 });

    const handlePaused = pausedCol.locator(`[data-opp-id="${SEED_OPPORTUNITY_DEMO}"] .pipeline-drag-handle`);
    const openDrop = page.locator('[data-drop-status="OPEN"]');
    await handlePaused.dragTo(openDrop);

    const openCol = page.getByRole("heading", { name: "Aperta" }).locator("..").locator("..");
    await expect(openCol.getByText(SEED_OPPORTUNITY_TITLE, { exact: true })).toBeVisible({ timeout: 25_000 });
  });
});
