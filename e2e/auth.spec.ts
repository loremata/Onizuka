import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsDemoClient } from "./helpers";

test.describe("Auth & routing", () => {
  test("unauthenticated / redirects toward login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin can sign in and reach admin area", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin/);
  });

  test("client user can sign in and reach app area", async ({ page }) => {
    await loginAsDemoClient(page);
    await expect(page).toHaveURL(/\/app/);
  });
});
