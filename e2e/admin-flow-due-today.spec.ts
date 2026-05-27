import { test, expect } from "@playwright/test";
import { calendarDatePrefixInTimeZone, loginAsAdmin } from "./helpers";

test.describe("Admin · Flow scadenze oggi", () => {
  test("task con scadenza oggi (Europe/Rome) compare in Scadenze oggi", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/settings");
    await page.getByLabel(/Fuso per «oggi» nel Command Center/).selectOption("Europe/Rome");
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);

    const ymd = calendarDatePrefixInTimeZone("Europe/Rome");
    const title = `E2E scadenza oggi ${Date.now()}`;

    await page.goto("/admin/flow");
    await page.getByLabel("Titolo").fill(title);
    await page.locator("#dueDate").fill(`${ymd}T12:00`);
    await page.getByRole("button", { name: "Crea task" }).click();
    await expect(page).toHaveURL(/\/admin\/flow$/);

    await expect(page.getByRole("heading", { name: "Scadenze oggi" })).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  });
});
