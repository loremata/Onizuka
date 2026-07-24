import { test, expect } from "@playwright/test";
import { loginAsDemoClient } from "./helpers";

test.describe("Client dashboard and notifications", () => {
  test("client can open dashboard and notifications", async ({ page }) => {
    await loginAsDemoClient(page);
    await page.goto("/app/dashboard");
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByText(/Tasso approvazione/i)).toBeVisible();

    await page.goto("/app/notifications");
    await expect(page.getByRole("heading", { name: /Notifiche/i })).toBeVisible();
  });
});
