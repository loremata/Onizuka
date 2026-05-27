import { test, expect } from "@playwright/test";

test.describe("Public status", () => {
  test("GET /status page loads", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: /Stato Onizuka/i })).toBeVisible();
  });
});
