import { spawnSync } from "node:child_process";
import { loadStagingEnvFiles } from "./staging-env";
import { assertStagingEnvironment } from "../src/lib/staging-guard";

loadStagingEnvFiles();
assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });

if (!process.env.DIRECT_URL?.trim()) {
  console.error("DIRECT_URL obbligatoria per migrate deploy su Supabase.");
  process.exit(1);
}

const shell = process.platform === "win32";
console.log("staging:migrate — backup Supabase consigliato prima di procedere.\n");

for (const args of [
  ["prisma", "validate"],
  ["prisma", "migrate", "status"],
  ["prisma", "migrate", "deploy"],
  ["prisma", "generate"],
]) {
  const r = spawnSync("npx", args, { stdio: "inherit", shell, env: process.env });
  if (r.status !== 0) {
    console.error("\nstaging:migrate FAIL — rollback: ripristina snapshot Supabase staging.");
    process.exit(r.status ?? 1);
  }
}

console.log("\nstaging:migrate PASS — esegui: npm run staging:seed && npm run staging:commercial-gate");
