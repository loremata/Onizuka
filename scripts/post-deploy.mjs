#!/usr/bin/env node
/**
 * Alias di passi-mancanti:prod (post-deploy Vercel).
 *   BASE_URL=https://onizuka.it CRON_SECRET=… npm run post-deploy
 */
import { spawnSync } from "node:child_process";

console.log("\n=== Onizuka post-deploy (→ passi-mancanti:prod) ===\n");
console.log("Prima: DIRECT_URL=… npm run db:deploy · seed solo primo env\n");

const r = spawnSync("node", ["scripts/passi-mancanti-prod.mjs"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(r.status ?? 1);
