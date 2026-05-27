#!/usr/bin/env node
/**
 * Verifica go-live locale: passi-mancanti check + smoke HTTP + cron (se CRON_SECRET).
 * Uso: npm run passi-mancanti:local
 */
import { spawnSync } from "node:child_process";
import { loadDotEnvFiles } from "./load-dotenv.mjs";

loadDotEnvFiles();

const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET?.trim();
const cronPaths = [
  "/api/cron/notifications",
  "/api/cron/webhook-retry",
  "/api/cron/reach-sequences",
];

function run(cmd, args) {
  return spawnSync(cmd, args, {
    env: { ...process.env, BASE_URL: base },
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

async function main() {
  console.log(`\n=== Local go-live verify (${base}) ===\n`);

  const check = run("node", ["scripts/passi-mancanti-check.mjs"]);
  if (check.status !== 0) {
    console.error("\npassi-mancanti:check fallito\n");
    process.exit(check.status ?? 1);
  }

  const smoke = run("node", ["scripts/smoke-production.mjs"]);
  if (smoke.status !== 0) process.exit(smoke.status ?? 1);

  if (cronSecret) {
    console.log("\n--- Cron locale ---\n");
    for (const path of cronPaths) {
      const res = await fetch(`${base}${path}`, {
        headers: { authorization: `Bearer ${cronSecret}` },
      });
      let ok = res.status === 200;
      if (ok) {
        const body = await res.json().catch(() => ({}));
        ok = body?.ok === true;
      }
      console.log(ok ? `  ✓ ${path}` : `  ✗ ${path} HTTP ${res.status}`);
      if (!ok) process.exitCode = 1;
    }
  } else {
    console.log(
      "\n(CRON_SECRET assente: skip cron. Aggiungi in .env per test /api/cron/* in locale.)\n"
    );
  }

  console.log("\nLocale verify OK. E2E admin: npx playwright test e2e/passi-mancanti-*.spec.ts\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
