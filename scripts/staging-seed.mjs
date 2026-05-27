#!/usr/bin/env node
import "./staging-load-env.mjs";
import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";

async function main() {
  const { assertStagingEnvironment } = await import("../src/lib/staging-guard.ts");
  assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });

  const r = spawnSync("npx", ["tsx", "prisma/seed-staging.ts"], {
    stdio: "inherit",
    shell,
    env: {
      ...process.env,
      ONIZUKA_E2E: "1",
      ONIZUKA_STAGING_SEED: "1",
      QUOTE_NOTIFY_EMAIL: process.env.QUOTE_NOTIFY_EMAIL ?? "0",
      TICKET_NOTIFY_EMAIL: process.env.TICKET_NOTIFY_EMAIL ?? "0",
      NOTIFY_DIGEST_EMAIL: process.env.NOTIFY_DIGEST_EMAIL ?? "0",
    },
  });
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
