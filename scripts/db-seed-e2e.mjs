#!/usr/bin/env node
/** Seed con ONIZUKA_E2E=1 (account demo senza mustChangePassword). */
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  env: { ...process.env, ONIZUKA_E2E: "1" },
  encoding: "utf8",
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(r.status ?? 1);
