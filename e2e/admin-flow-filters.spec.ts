import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/** Titolo task seed alpha (`prisma/seed.ts` + `SEED_FLOW_TASK_ALPHA`). */
const SEED_TASK_ALPHA_TITLE = "Follow-up commerciale (demo)";

test.describe("Flow · filtri GET", () => {
  test("ricerca testuale mostra il task seed alpha", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/flow?q=Follow-up");

    await expect(page.getByText(SEED_TASK_ALPHA_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  test("filtro stato TODO mostra almeno il task seed alpha", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/flow?status=TODO");

    await expect(page.getByText(SEED_TASK_ALPHA_TITLE, { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
