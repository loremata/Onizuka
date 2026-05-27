import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin · ricerca referenti", () => {
  test("query su nome seed referente", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/search?q=Laura");

    await expect(page.getByRole("heading", { name: "Referenti" })).toBeVisible();
    await expect(page.getByText("Laura Bianchi", { exact: true }).first()).toBeVisible();
  });
});
