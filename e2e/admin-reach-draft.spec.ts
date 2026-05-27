import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin Reach", () => {
  test("reach page shows stats and draft section", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/reach");
    await expect(page.getByRole("heading", { name: /Onizuka Reach/i })).toBeVisible();
    await expect(page.getByText(/Bozze outreach/i)).toBeVisible();
  });
});
