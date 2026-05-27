import { test, expect } from "@playwright/test";

/** Smoke route pubbliche — PASSI-MANCANTI.md §4 */
const publicRoutes = [
  { path: "/walkin", titleFragment: /Benvenuto|Onizuka/i },
  { path: "/status", status: 200 },
  { path: "/login", status: 200 },
  { path: "/robots.txt", status: 200 },
  { path: "/.well-known/security.txt", status: 200 },
];

test.describe("PASSI-MANCANTI smoke route pubbliche", () => {
  for (const route of publicRoutes) {
    test(`GET ${route.path}`, async ({ page, request }) => {
      if (route.path.endsWith(".txt")) {
        const res = await request.get(route.path);
        expect(res.status()).toBe(route.status ?? 200);
        return;
      }
      const res = await page.goto(route.path);
      expect(res?.status()).toBeLessThan(500);
      if (route.titleFragment) {
        await expect(page.locator("body")).toContainText(route.titleFragment);
      }
    });
  }
});
