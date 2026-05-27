import { spawnSync } from "node:child_process";
import { loadStagingEnvFiles } from "./staging-env";
import { assertSafeE2EBaseUrl, isRemotePlaywrightBase } from "../src/lib/staging-guard";

loadStagingEnvFiles();
assertSafeE2EBaseUrl();

if (!isRemotePlaywrightBase()) {
  console.warn("WARN: PLAYWRIGHT_BASE_URL è localhost — usa npm run test:e2e:* per locale.");
}

const target = process.argv[2] ?? "all";
const map: Record<string, string[]> = {
  dashboard: ["playwright", "test", "admin-commercial-dashboard", "--project=chromium"],
  "audit-crm": ["playwright", "test", "e2e/admin-audit-commercial-crm.spec.ts", "--project=chromium"],
  all: [
    "playwright",
    "test",
    "e2e/admin-commercial-dashboard.spec.ts",
    "e2e/admin-audit-commercial-crm.spec.ts",
    "--project=chromium",
  ],
};

const args = map[target];
if (!args) {
  console.error(`Target sconosciuto: ${target}. Usa: dashboard | audit-crm | all`);
  process.exit(1);
}

const shell = process.platform === "win32";
const env = {
  ...process.env,
  PLAYWRIGHT_NO_WEBSERVER: "1",
  PLAYWRIGHT_SKIP_SEED: "1",
  PLAYWRIGHT_E2E: "1",
  ONIZUKA_E2E: "1",
};

console.log(`staging:e2e (${target}) → ${process.env.PLAYWRIGHT_BASE_URL}\n`);
const r = spawnSync("npx", args, { stdio: "inherit", shell, env });
process.exit(r.status ?? 1);
