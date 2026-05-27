#!/usr/bin/env node
/**
 * Checklist preparazione / post-deploy produzione (onizuka.it).
 * Usa variabili come su Vercel (.env con valori prod o export da dashboard).
 *
 *   npm run passi-mancanti:prod
 *   BASE_URL=https://onizuka.it CRON_SECRET=… npm run passi-mancanti:prod
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDotEnvFiles, loadEnvFile } from "./load-dotenv.mjs";

const root = process.cwd();
loadDotEnvFiles(root);
if (existsSync(join(root, ".env.production"))) {
  loadEnvFile(root, ".env.production", { override: true });
}

console.log("\n=== Passi mancanti — verifica produzione ===\n");

const check = spawnSync("node", ["scripts/deploy-check.mjs"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
if (check.status !== 0) {
  console.log("\nCorreggi env (template: vercel-env.template) · guida: docs/DEPLOY.md\n");
  process.exit(check.status ?? 1);
}

const base = (process.env.BASE_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");

if (!base.startsWith("https://")) {
  console.log("\n--- Smoke HTTP produzione (skip) ---\n");
  console.log("  Imposta BASE_URL=https://onizuka.it dopo il deploy Vercel, poi:");
  console.log("  BASE_URL=https://onizuka.it CRON_SECRET=<secret> npm run passi-mancanti:prod\n");
  console.log("Prossimi passi ops:");
  console.log("  1. DIRECT_URL=… npm run db:deploy");
  console.log("  2. DNS Hostinger → Vercel");
  console.log("  3. GHA secrets (.github/workflows/README.md)\n");
  process.exit(0);
}

console.log(`\n--- Smoke HTTP ${base} ---\n`);
const smoke = spawnSync("node", ["scripts/smoke-production.mjs"], {
  stdio: "inherit",
  env: { ...process.env, BASE_URL: base },
  shell: process.platform === "win32",
});

if (smoke.status !== 0) process.exit(smoke.status ?? 1);

console.log("\n✓ Env produzione + smoke HTTP OK.");
console.log("  Manuale: /admin/go-live · PASSI-MANCANTI.md §4 post-deploy\n");
