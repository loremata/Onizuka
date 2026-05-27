import { test, expect } from "@playwright/test";

test.describe("Route pubbliche", () => {
  test("sitemap.xml", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain("<urlset");
    expect(text).toContain("/login");
  });

  test("security.txt", async ({ request }) => {
    const res = await request.get("/.well-known/security.txt");
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text.toLowerCase()).toContain("contact:");
  });

  test("status page", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByRole("heading", { name: /Stato Onizuka/i })).toBeVisible();
  });
});
