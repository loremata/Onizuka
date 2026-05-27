#!/usr/bin/env node
/**
 * Avvio rapido setup produzione (checklist + env).
 *   node --env-file=.env.production scripts/setup-production.mjs
 *   npm run setup:prod
 */
import { spawnSync } from "node:child_process";

console.log("\n=== Onizuka setup produzione ===\n");

const bootstrap = spawnSync("node", ["scripts/bootstrap-production.mjs"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

if (bootstrap.status !== 0) {
  process.exit(bootstrap.status ?? 1);
}

console.log("\n--- Prossimi comandi ---\n");
console.log("  DIRECT_URL=… npm run db:deploy");
console.log("  git push → Vercel deploy");
console.log("  BASE_URL=https://onizuka.it CRON_SECRET=… npm run passi-mancanti:prod");
console.log("  Browser: /admin/go-live\n");
