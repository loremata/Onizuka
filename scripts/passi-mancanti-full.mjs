#!/usr/bin/env node
/**
 * Verifica locale completa senza Playwright (check + smoke/cron + Jest upload).
 * E2E browser: npm run passi-mancanti:e2e (con npm run dev attivo).
 */
import { spawnSync } from "node:child_process";
import { loadDotEnvFiles } from "./load-dotenv.mjs";

loadDotEnvFiles();

function run(label, args) {
  console.log(`\n--- ${label} ---\n`);
  const r = spawnSync("npm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("passi-mancanti:check", ["run", "passi-mancanti:check"]);
run("passi-mancanti:local", ["run", "passi-mancanti:local"]);
run("Jest storage + upload", [
  "test",
  "--",
  "storage-local-upload",
  "post-media-upload.local",
]);

console.log("\n✓ Verifica locale automatica completa.");
console.log("  E2E (opzionale): npm run db:seed:e2e && npm run passi-mancanti:e2e\n");
