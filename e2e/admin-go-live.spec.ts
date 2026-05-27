import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin go-live hub", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("pagina go-live con checklist e stato deploy", async ({ page }) => {
    await page.goto("/admin/go-live");
    await expect(page.getByRole("heading", { name: "Go-live" })).toBeVisible();
    await expect(page.getByText("Checklist produzione")).toBeVisible();
    await expect(page.getByText("Stato deploy")).toBeVisible();
    await expect(page.getByText("Sicurezza account demo")).toBeVisible();
    await expect(page.getByRole("button", { name: /smoke test/i })).toBeVisible();
  });
});
