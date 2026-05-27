import { test, expect } from "@playwright/test";

/** Route admin da PASSI-MANCANTI.md §4 (smoke post-login). */
const adminRoutes: { path: string; heading: RegExp }[] = [
  { path: "/admin", heading: /Command Center/i },
  { path: "/admin/go-live", heading: /Go-live/i },
  { path: "/admin/regia-operativa", heading: /Regia operativa/i },
  { path: "/admin/intelligence", heading: /Intelligence/i },
  { path: "/admin/crm/contacts", heading: /Contatti unificati/i },
  { path: "/admin/crm/opportunity-bottlenecks", heading: /SLA opportunità/i },
  { path: "/admin/chat", heading: /Assistente chat/i },
  { path: "/admin/ai-runs", heading: /Esecuzioni AI/i },
  { path: "/admin/flow", heading: /Onizuka Flow/i },
  { path: "/admin/activity", heading: /Registro attività/i },
  { path: "/admin/reports/service-activations", heading: /Attivazioni per servizio/i },
];

test.describe("PASSI-MANCANTI smoke admin", () => {
  test("route admin §4 (un login)", async ({ page }) => {
    test.setTimeout(120_000);

    for (const route of adminRoutes) {
      const res = await page.goto(route.path);
      expect(res?.status(), route.path).toBeLessThan(500);
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible({
        timeout: 20_000,
      });
    }

    await page.goto("/admin/clients?q=Demo%20Client");
    await page.getByRole("link", { name: "Scheda" }).first().click();
    await expect(page.getByRole("heading", { name: "Onboarding" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Avanzamento onboarding")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Impegni interni" })).toBeVisible();
  });
});
