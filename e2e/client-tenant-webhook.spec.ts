import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsDemoClient, loginAsOtherClient } from "./helpers";
import { SEED_DEMO_APPROVED_POST_ID, SEED_DEMO_PENDING_POST_ID } from "./seed-constants";

test.describe("Cross-tenant post URL", () => {
  test("demo client can open seeded APPROVED post", async ({ page }) => {
    await loginAsDemoClient(page);
    const response = await page.goto(`/app/posts/${SEED_DEMO_APPROVED_POST_ID}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Seed APPROVED for n8n E2E")).toBeVisible();
  });

  test("other tenant gets 404 on demo client post id", async ({ page }) => {
    await loginAsOtherClient(page);
    const response = await page.goto(`/app/posts/${SEED_DEMO_APPROVED_POST_ID}`);
    expect(response?.status()).toBe(404);
  });
});

test.describe("Client UI: approve", () => {
  test("client can approve seeded PENDING post (idempotent)", async ({ page }) => {
    await loginAsDemoClient(page);
    await page.goto(`/app/posts/${SEED_DEMO_PENDING_POST_ID}`);
    await expect(page.getByText("Seed PENDING for approve E2E")).toBeVisible();

    const approve = page.getByRole("button", { name: "Approva" });
    if (await approve.isVisible()) {
      await approve.click();
    }
    await expect(page.getByText("Approvato").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Admin webhooks UI", () => {
  test("admin can open webhooks page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/webhooks");
    await expect(page.getByRole("heading", { name: "Webhook n8n" })).toBeVisible();
    await expect(page.getByText("Nuova sottoscrizione")).toBeVisible();
  });
});
