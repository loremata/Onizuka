import { test, expect } from "@playwright/test";

test.describe("Health", () => {
  test("GET /api/health returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
  });

  test("GET /api/health/ready returns 200 when DB is up", async ({ request }) => {
    const res = await request.get("/api/health/ready");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, status: "ready", database: "ok" });
  });
});
