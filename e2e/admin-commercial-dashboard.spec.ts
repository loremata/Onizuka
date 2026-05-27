import { test, expect } from "@playwright/test";

/**
 * E2E dashboard commerciale (KPI-02 / ST-03).
 * Playwright avvia `npm run dev` e seed E2E in global-setup (salvo PLAYWRIGHT_NO_WEBSERVER=1).
 * Comando: `npm run test:e2e:dashboard`
 */
test.describe("Admin · dashboard commerciale", () => {
  test("sezioni, KPI e filtri URL", async ({ page }) => {
    await page.goto("/admin/crm/commercial");
    await expect(page.getByRole("heading", { name: "Dashboard commerciale" })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText("1. Oggi devo fare")).toBeVisible();
    await expect(page.getByText("2. Opportunità commerciali")).toBeVisible();
    await expect(page.getByText("3. Audit & prospecting")).toBeVisible();
    await expect(page.getByText("4. Clienti & monetizzazione")).toBeVisible();
    await expect(page.getByText("5. Igiene dati")).toBeVisible();

    await expect(page.getByText("Lead totali")).toBeVisible();
    await expect(page.getByText("Opportunità aperte")).toBeVisible();

    await page.getByRole("link", { name: "7 giorni" }).click();
    await expect(page).toHaveURL(/period=7/);

    await page.getByRole("link", { name: /Dati incompleti|Solo incompleti/ }).click();
    await expect(page).toHaveURL(/incomplete=1/);

    await page.getByRole("link", { name: "QUALIFIED" }).click();
    await expect(page).toHaveURL(/leadStatus=QUALIFIED/);

    await page
      .locator('a[href*="oppPriority=HIGH"]')
      .first()
      .click();
    await expect(page).toHaveURL(/oppPriority=HIGH/);

    const ctaHref = await page.locator('main a[href="/admin/crm/leads"]').first().getAttribute("href");
    expect(ctaHref).toBe("/admin/crm/leads");
    await page.goto(ctaHref!);
    await expect(page).toHaveURL(/\/admin\/crm\/leads/);

    await expect(page.getByText(/Unhandled Runtime Error|Application error/i)).toHaveCount(0);
  });
});
