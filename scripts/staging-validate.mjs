#!/usr/bin/env node
import "./staging-load-env.mjs";
import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function guard() {
  const { assertCommercialGateSafe, assertSafeE2EBaseUrl } = await import("../src/lib/staging-guard.ts");
  assertCommercialGateSafe();
  if (process.env.PLAYWRIGHT_BASE_URL) {
    assertSafeE2EBaseUrl();
  }
  console.log("staging-guard: OK");
  console.log("ONIZUKA_ENV:", process.env.ONIZUKA_ENV ?? "(unset)");
  console.log("DB marker:", process.env.ONIZUKA_STAGING_DB_MARKER ?? "(unset)");
}

console.log("staging:validate — prisma + guard\n");
await guard();
run("npx", ["prisma", "validate"]);
run("npx", ["prisma", "migrate", "status"]);
console.log("\nstaging:validate PASS");
