import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin Voice", () => {
  test("voice page shows recap", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/voice");
    await expect(page.getByRole("heading", { name: /Onizuka Voice/i })).toBeVisible();
    await expect(page.getByText(/Recap Onizuka/i)).toBeVisible();
  });
});
