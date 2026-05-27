import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin · fuso recap", () => {
  test("salvataggio profilo e etichetta sul Command Center", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "Fuso orario recap" })).toBeVisible();

    await page.getByLabel(/Fuso per «oggi» nel Command Center/).selectOption("Europe/Rome");
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);

    await page.goto("/admin");
    await expect(page.getByText(/Europe\/Rome \(profilo utente\)/)).toBeVisible();
  });
});
