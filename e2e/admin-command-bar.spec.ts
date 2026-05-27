import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin · barra comando", () => {
  test("Ctrl+K mette il focus sul campo Chiedi a Onizuka", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin");

    await page.keyboard.press("Control+K");
    await expect(page.locator('input[name="ask"]')).toBeFocused({ timeout: 10_000 });
  });
});
