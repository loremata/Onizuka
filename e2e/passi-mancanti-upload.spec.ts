import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginAsDemoClient } from "./helpers";

test.describe("PASSI-MANCANTI upload locale", () => {
  test("cliente demo carica materiale su /app/upload", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsDemoClient(page);
    await page.goto("/app/upload");
    await expect(page.getByRole("heading", { name: "Invia creatività" })).toBeVisible();

    const fixture = path.join(__dirname, "fixtures", "test.png");
    await page.locator('input[type="file"][name="media"]').setInputFiles(fixture);
    await page.getByRole("button", { name: "Invia materiale" }).click();

    await expect(
      page.getByText(/Materiale inviato|post inviati|notifica quando sar/i)
    ).toBeVisible({ timeout: 30_000 });
  });
});
