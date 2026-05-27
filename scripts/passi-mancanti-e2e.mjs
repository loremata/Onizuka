#!/usr/bin/env node
/**
 * E2E PASSI-MANCANTI (richiede npm run dev su :3000).
 */
import { spawnSync } from "node:child_process";
import { loadDotEnvFiles } from "./load-dotenv.mjs";

loadDotEnvFiles();

const specs = [
  "e2e/passi-mancanti-routes.spec.ts",
  "e2e/passi-mancanti-admin.spec.ts",
  "e2e/passi-mancanti-cron.spec.ts",
  "e2e/passi-mancanti-upload.spec.ts",
];

const r = spawnSync(
  "npx",
  ["playwright", "test", ...specs, "--workers=1"],
  { stdio: "inherit", shell: process.platform === "win32", env: process.env }
);

process.exit(r.status ?? 1);
