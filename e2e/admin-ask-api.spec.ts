import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Admin ask API", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("POST /api/admin/ask returns orchestration", async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const res = await request.post("/api/admin/ask", {
      headers: { cookie: cookieHeader, "Content-Type": "application/json" },
      data: { q: "pipeline" },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.primaryHref).toContain("/admin/crm/pipeline");
    expect(body.answer).toBeTruthy();
  });
});
