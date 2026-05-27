import { spawnSync } from "node:child_process";
import { loadStagingEnvFiles } from "./staging-env";
import { assertStagingEnvironment } from "../src/lib/staging-guard";

loadStagingEnvFiles();
assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });

const shell = process.platform === "win32";
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
