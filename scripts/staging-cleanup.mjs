#!/usr/bin/env node
import "./staging-load-env.mjs";
import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";

async function main() {
  const { getOnizukaEnv } = await import("../src/lib/onizuka-env.ts");
  const guards = await import("../src/lib/staging-guard.ts");

  if (getOnizukaEnv() === "staging") {
    guards.assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });
  } else {
    guards.assertNotProductionDatabase();
  }

  const r = spawnSync("npx", ["tsx", "scripts/staging-cleanup-runner.ts"], {
    stdio: "inherit",
    shell,
    env: process.env,
  });
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
