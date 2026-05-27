#!/usr/bin/env node
/**
 * E2E contro PLAYWRIGHT_BASE_URL staging (no webServer locale).
 * Uso: npm run staging:test:e2e:dashboard
 */
import "./staging-load-env.mjs";
import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";
const target = process.argv[2] ?? "all";

async function main() {
  const { assertSafeE2EBaseUrl, isRemotePlaywrightBase } = await import("../src/lib/staging-guard.ts");
  assertSafeE2EBaseUrl();

  if (!isRemotePlaywrightBase()) {
    console.warn("WARN: PLAYWRIGHT_BASE_URL è localhost — usa npm run test:e2e:* per locale.");
  }

  const env = {
    ...process.env,
    PLAYWRIGHT_NO_WEBSERVER: "1",
    PLAYWRIGHT_SKIP_SEED: "1",
    PLAYWRIGHT_E2E: "1",
    ONIZUKA_E2E: "1",
  };

  const map = {
    dashboard: ["playwright", "test", "admin-commercial-dashboard", "--project=chromium"],
    "audit-crm": ["playwright", "test", "e2e/admin-audit-commercial-crm.spec.ts", "--project=chromium"],
    all: ["playwright", "test", "e2e/admin-commercial-dashboard.spec.ts", "e2e/admin-audit-commercial-crm.spec.ts", "--project=chromium"],
  };

  const args = map[target];
  if (!args) {
    console.error(`Target sconosciuto: ${target}. Usa: dashboard | audit-crm | all`);
    process.exit(1);
  }

  console.log(`staging:e2e (${target}) → ${process.env.PLAYWRIGHT_BASE_URL}\n`);
  const r = spawnSync("npx", args, { stdio: "inherit", shell, env });
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
