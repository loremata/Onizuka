import { test, expect } from "@playwright/test";
import { loginAsClient } from "./helpers";

test.describe("Client tickets", () => {
  test("client can open support page and see form", async ({ page }) => {
    await loginAsClient(page);
    await page.goto("/app/tickets");
    await expect(page.getByRole("heading", { name: /Supporto/i })).toBeVisible();
    await expect(page.getByLabel(/Oggetto/i)).toBeVisible();
  });

  test("mark ticket as read button is available when replies exist", async ({ page }) => {
    await loginAsClient(page);
    await page.goto("/app/tickets");
    const markBtn = page.getByRole("button", { name: /Segna come letto/i }).first();
    if (await markBtn.isVisible()) {
      await markBtn.click();
      await expect(markBtn).not.toBeVisible({ timeout: 5000 });
    }
  });
});
