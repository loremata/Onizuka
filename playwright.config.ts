import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const adminAuthFile = join(process.cwd(), "e2e/.auth/admin.json");

function loadEnvFile(name: string, override: boolean) {
  const path = join(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);
loadEnvFile(".env.staging", false);

// Stesso host di NEXTAUTH_URL (localhost ≠ 127.0.0.1 per i cookie di sessione).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const remoteBase = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
const reuseServer = process.env.PLAYWRIGHT_REUSE_SERVER !== "0" && !process.env.CI && !remoteBase;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /admin-auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: adminAuthFile,
      },
      dependencies: ["setup"],
      testIgnore: [/admin-auth\.setup\.ts/, /passi-mancanti-upload\.spec\.ts/],
    },
    {
      name: "chromium-client",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /passi-mancanti-upload\.spec\.ts/,
    },
  ],
  webServer:
    remoteBase || process.env.PLAYWRIGHT_NO_WEBSERVER === "1"
      ? undefined
      : {
        command: process.env.CI ? "npm run start" : "npm run dev",
        url: `${baseURL}/login`,
        reuseExistingServer: reuseServer,
        timeout: process.env.CI ? 120_000 : 180_000,
        env: {
          ...process.env,
          PLAYWRIGHT_E2E: "1",
          ONIZUKA_E2E: "1",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
});
