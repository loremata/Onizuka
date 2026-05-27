import path from "path";
import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsDemoClient, loginAsOtherClient } from "./helpers";

test.describe.configure({ mode: "serial" });

let createdCaption: string;

test.describe("Admin post + tenant isolation", () => {
  test("admin creates post with media for Demo Client Co", async ({ page }) => {
    createdCaption = `E2E caption ${Date.now()}`;
    await loginAsAdmin(page);
    await page.goto("/admin/posts/new");
    await expect(page.getByRole("heading", { name: "Nuovo post" })).toBeVisible();

    await page.locator("#clientId").selectOption({ label: "Demo Client Co (demo-client)" });
    await page.locator("#captionText").fill(createdCaption);

    const fixture = path.join(process.cwd(), "e2e", "fixtures", "test.png");
    await page.locator("#media").setInputFiles(fixture);

    await page.getByRole("button", { name: "Crea post" }).click();
    await expect(page).toHaveURL(/\/admin\/posts/, { timeout: 30_000 });
    await expect(page.getByRole("cell", { name: createdCaption })).toBeVisible();
  });

  test("demo client sees the new post on /app", async ({ page }) => {
    await loginAsDemoClient(page);
    await page.goto("/app");
    await expect(page.getByText("Contenuti da revisionare")).toBeVisible();
    await expect(page.getByText(createdCaption)).toBeVisible();
  });

  test("other tenant does not see demo client post", async ({ page }) => {
    await loginAsOtherClient(page);
    await page.goto("/app");
    await expect(page.getByText("Contenuti da revisionare")).toBeVisible();
    await expect(page.getByText(createdCaption)).toHaveCount(0);
  });
});
