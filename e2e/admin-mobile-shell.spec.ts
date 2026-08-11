import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * Shell mobile (/admin/m). Il test che conta davvero e' l'ultimo: la chrome
 * desktop viene nascosta da un wrapper client nel layout admin, che sta sopra
 * TUTTE le pagine — se quel wrapper sbaglia condizione, sparisce la
 * navigazione anche dove serve (e /admin/memory comincia per "/admin/m").
 */
test.describe("Shell mobile", () => {
  test("/admin/m porta al gesto piu' frequente", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/m");

    // In dev la prima compilazione della rotta di destinazione supera i 5s di
    // default di toHaveURL: il redirect c'e', ma la navigazione arriva dopo.
    await expect(page).toHaveURL(/\/admin\/m\/registra$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Registra", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("la barra in basso ha i 4 gesti e niente chrome desktop", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/m/registra");

    const tabs = page.getByRole("navigation", { name: "Navigazione rapida" });
    await expect(tabs).toBeVisible({ timeout: 20_000 });
    for (const label of ["Registra", "In arrivo", "Cerca", "Mosse"]) {
      await expect(tabs.getByRole("link", { name: label })).toBeVisible();
    }

    await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Strumenti" })).toHaveCount(0);
  });

  test("le altre tre viste rispondono", async ({ page }) => {
    await loginAsAdmin(page);

    for (const [path, heading] of [
      ["/admin/m/lead", "In arrivo"],
      ["/admin/m/cerca", "Cerca"],
      ["/admin/m/mosse", "Prossime mosse"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible({
        timeout: 20_000,
      });
    }
  });

  test("REGRESSIONE: il desktop tiene la sua navigazione, /admin/memory compresa", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("navigation", { name: "Navigazione rapida" })).toHaveCount(0);

    // /admin/memory comincia per "/admin/m": con un match per prefisso sbagliato
    // qui la navigazione sparirebbe.
    await page.goto("/admin/memory");
    await expect(page.getByRole("navigation", { name: "Navigazione principale" })).toBeVisible({
      timeout: 20_000,
    });
  });
});
