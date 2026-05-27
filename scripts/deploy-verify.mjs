#!/usr/bin/env node
/**
 * Alias di passi-mancanti:prod (retrocompatibilità).
 *   BASE_URL=https://onizuka.it CRON_SECRET=… npm run deploy:verify
 */
import { spawnSync } from "node:child_process";

const r = spawnSync("node", ["scripts/passi-mancanti-prod.mjs"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(r.status ?? 1);
