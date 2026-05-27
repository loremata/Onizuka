import { test, expect } from "@playwright/test";
import { SEED_DEMO_APPROVED_POST_ID } from "./seed-constants";

test.describe("N8n HTTP API", () => {
  test("GET approved without key returns 401 when N8N_API_KEY is configured", async ({
    request,
  }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const res = await request.get("/api/n8n/approved?clientSlug=demo-client");
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("GET approved with wrong key returns 401", async ({ request }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const res = await request.get("/api/n8n/approved?clientSlug=demo-client", {
      headers: { "X-API-Key": "definitely-wrong-key" },
    });
    expect(res.status()).toBe(401);
    const wrong = await res.json();
    expect(wrong).toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("GET approved with valid key returns JSON items including seed post", async ({
    request,
  }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const key = process.env.N8N_API_KEY!;
    const res = await request.get("/api/n8n/approved?clientSlug=demo-client", {
      headers: { "X-API-Key": key },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ items: expect.any(Array) });
    const ids = (body.items as { postItemId: string }[]).map((i) => i.postItemId);
    expect(ids).toContain(SEED_DEMO_APPROVED_POST_ID);
  });

  test("GET approved without clientSlug returns 400", async ({ request }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const key = process.env.N8N_API_KEY!;
    const res = await request.get("/api/n8n/approved", {
      headers: { "X-API-Key": key },
    });
    expect(res.status()).toBe(400);
    const err = await res.json();
    expect(err).toMatchObject({ code: "MISSING_CLIENT_SLUG" });
  });

  test("POST mark-published without key returns 401", async ({ request }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const res = await request.post("/api/n8n/mark-published", {
      data: { postItemId: SEED_DEMO_APPROVED_POST_ID },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("POST mark-published without postItemId returns 400", async ({ request }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const key = process.env.N8N_API_KEY!;
    const res = await request.post("/api/n8n/mark-published", {
      headers: { "X-API-Key": key },
      data: {},
    });
    expect(res.status()).toBe(400);
    const err = await res.json();
    expect(err).toMatchObject({ code: "MISSING_POST_ITEM_ID" });
  });

  test("POST mark-published unknown id returns 404", async ({ request }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const key = process.env.N8N_API_KEY!;
    const res = await request.post("/api/n8n/mark-published", {
      headers: { "X-API-Key": key },
      data: { postItemId: "clnonexistent00000000000000000" },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ code: "POST_NOT_FOUND" });
  });

  test("POST mark-published with valid key updates seed post", async ({ request }) => {
    test.skip(!process.env.N8N_API_KEY, "N8N_API_KEY not set");
    const key = process.env.N8N_API_KEY!;
    const publishedAt = "2026-01-15T12:00:00.000Z";
    const res = await request.post("/api/n8n/mark-published", {
      headers: { "X-API-Key": key },
      data: {
        postItemId: SEED_DEMO_APPROVED_POST_ID,
        publishedAt,
        externalRef: "e2e-n8n-ref",
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
  });
});
