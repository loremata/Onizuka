import { spawnSync } from "node:child_process";
import { loadStagingEnvFiles } from "./staging-env";
import { assertCommercialGateSafe, assertSafeE2EBaseUrl } from "../src/lib/staging-guard";

loadStagingEnvFiles();

const shell = process.platform === "win32";

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("staging:validate — prisma + guard\n");
assertCommercialGateSafe();
if (process.env.PLAYWRIGHT_BASE_URL) {
  assertSafeE2EBaseUrl();
}
console.log("staging-guard: OK");
console.log("ONIZUKA_ENV:", process.env.ONIZUKA_ENV ?? "(unset)");
console.log("DB marker:", process.env.ONIZUKA_STAGING_DB_MARKER ?? "(unset)");

run("npx", ["prisma", "validate"]);
run("npx", ["prisma", "migrate", "status"]);
console.log("\nstaging:validate PASS");
