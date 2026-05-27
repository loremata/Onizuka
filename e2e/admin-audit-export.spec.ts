import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin audit export", () => {
  test("audit page shows export and filters", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: /Onizuka Audit/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Esporta CSV/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Filtra/i })).toBeVisible();
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("admin settings shows deploy status", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: /Stato deploy/i })).toBeVisible();
    await expect(page.getByText(/Ambiente:/i)).toBeVisible({ timeout: 10000 });
  });

  test("admin notifications page has digest control", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/notifications");
    await expect(page.getByRole("heading", { name: /Notifiche/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Invia digest email/i })).toBeVisible();
  });
});
