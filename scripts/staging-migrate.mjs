#!/usr/bin/env node
/**
 * Applica migration su DB staging (DIRECT_URL).
 * Richiede: ONIZUKA_ENV=staging, ONIZUKA_STAGING_DB_MARKER, ONIZUKA_STAGING_CONFIRM=yes
 * Prima: snapshot/backup Supabase staging.
 */
import "./staging-load-env.mjs";
import { spawnSync } from "node:child_process";

const shell = process.platform === "win32";

async function main() {
  const { assertStagingEnvironment } = await import("../src/lib/staging-guard.ts");
  assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });

  if (!process.env.DIRECT_URL?.trim()) {
    console.error("DIRECT_URL obbligatoria per migrate deploy su Supabase.");
    process.exit(1);
  }

  console.log("staging:migrate — backup Supabase consigliato prima di procedere.\n");

  const steps = [
    ["npx", ["prisma", "validate"]],
    ["npx", ["prisma", "migrate", "status"]],
    ["npx", ["prisma", "migrate", "deploy"]],
    ["npx", ["prisma", "generate"]],
  ];

  for (const [cmd, args] of steps) {
    const r = spawnSync(cmd, args, { stdio: "inherit", shell, env: process.env });
    if (r.status !== 0) {
      console.error("\nstaging:migrate FAIL — rollback: ripristina snapshot Supabase staging.");
      process.exit(r.status ?? 1);
    }
  }

  console.log("\nstaging:migrate PASS — esegui: npm run staging:seed && npm run staging:commercial-gate");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
