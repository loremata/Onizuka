import { test as setup } from "@playwright/test";
import { ADMIN_AUTH_FILE } from "./admin-auth";
import { loginAsAdmin } from "./helpers";

setup("sessione admin", async ({ page }) => {
  setup.setTimeout(90_000);
  await loginAsAdmin(page);
  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
