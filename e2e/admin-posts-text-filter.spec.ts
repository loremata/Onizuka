import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Post · filtro testo", () => {
  test("ricerca su didascalia seed", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/posts?q=n8n%20E2E");

    await expect(page.getByText("Seed APPROVED for n8n E2E", { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
