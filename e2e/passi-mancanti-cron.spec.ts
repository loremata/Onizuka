import { test, expect } from "@playwright/test";

const cronSecret = process.env.CRON_SECRET?.trim();

test.describe("PASSI-MANCANTI cron API", () => {
  test.skip(!cronSecret, "Imposta CRON_SECRET (.env / .env.local) e riavvia npm run dev");

  for (const path of [
    "/api/cron/notifications",
    "/api/cron/webhook-retry",
    "/api/cron/reach-sequences",
  ]) {
    test(`GET ${path}`, async ({ request }) => {
      const res = await request.get(path, {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { ok?: boolean };
      expect(body.ok).toBe(true);
    });
  }
});
