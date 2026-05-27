#!/usr/bin/env node
/**
 * Verifica automatica voci PASSI-MANCANTI.md verificabili da repo/env locale.
 * Uso: node --env-file=.env scripts/passi-mancanti-check.mjs
 *      npm run passi-mancanti:check
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadDotEnvFiles } from "./load-dotenv.mjs";

const root = process.cwd();
loadDotEnvFiles(root);

function env(name) {
  return process.env[name]?.trim() ?? "";
}

/** @type {Map<number, { num: number; id: string; status: string; detail?: string }>} */
const byNum = new Map();

function set(num, id, status, detail) {
  byNum.set(num, { num, id, status, detail });
}

// --- Repo ---
const repoChecks = [
  [10, "cron-secret", "vercel.json"],
  [12, "smoke-prod", "scripts/smoke-production.mjs"],
  [13, "go-live-hub", "src/app/admin/go-live/page.tsx"],
  [16, "gha-cron", ".github/workflows/cron-audit-sheet-queue.yml"],
  [19, "deploy-verify", "scripts/deploy-verify.mjs"],
];

for (const [num, id, file] of repoChecks) {
  const ok = existsSync(join(root, file));
  set(num, id, ok ? "done" : "todo", ok ? "artefatto in repo" : `${file} mancante`);
}

const batchFInRepo = existsSync(
  join(root, "prisma/migrations/20260620400000_audit_gap_batch_f/migration.sql")
);
set(
  5,
  "migrate-deploy",
  batchFInRepo ? "warn" : "todo",
  batchFInRepo ? "SQL in repo — applicare con db:deploy" : "migrazione batch F assente"
);

// --- Env ---
const deploy = spawnSync("node", ["scripts/deploy-check.mjs"], {
  env: process.env,
  encoding: "utf8",
  shell: process.platform === "win32",
});
const deployOut = `${deploy.stdout ?? ""}${deploy.stderr ?? ""}`;

set(3, "database-url", env("DATABASE_URL") ? "warn" : "todo", env("DATABASE_URL") ? "impostata" : "mancante");
set(4, "direct-url", env("DIRECT_URL") ? "done" : "todo", env("DIRECT_URL") ? "ok" : "mancante");
set(
  7,
  "nextauth",
  env("NEXTAUTH_SECRET")?.length >= 32 && env("NEXTAUTH_URL") ? "done" : "todo",
  "NEXTAUTH_URL + SECRET"
);
set(8, "primary-host", env("ONIZUKA_PRIMARY_HOST") ? "done" : "warn", env("ONIZUKA_PRIMARY_HOST") || "consigliato onizuka.it");
const localUpload = env("ALLOW_LOCAL_UPLOAD_SERVE") === "1";
set(
  9,
  "storage-s3",
  env("S3_BUCKET") && env("S3_ACCESS_KEY")
    ? "done"
    : localUpload
      ? "warn"
      : "todo",
  env("S3_BUCKET")
    ? "S3/R2"
    : localUpload
      ? "locale: ALLOW_LOCAL_UPLOAD_SERVE (prod richiede R2)"
      : "S3/R2 o ALLOW_LOCAL_UPLOAD_SERVE in dev"
);
const cronRepo = byNum.get(10)?.status === "done";
set(
  10,
  "cron-secret",
  env("CRON_SECRET") ? "done" : cronRepo ? "warn" : "todo",
  env("CRON_SECRET") ? "ok" : cronRepo ? "vercel.json ok; manca CRON_SECRET in env" : "mancante"
);
set(15, "smtp", env("GMAIL_SMTP_HOST") && env("GMAIL_SMTP_USER") ? "done" : "warn", "SMTP");
set(17, "upstash", env("UPSTASH_REDIS_REST_URL") ? "done" : "warn", "Upstash");

if (env("DATABASE_URL")) {
  const probe = spawnSync("npx", ["tsx", "scripts/probe-batch-f-migration.ts"], {
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  set(
    5,
    "migrate-deploy",
    probe.status === 0 ? "done" : "todo",
    probe.status === 0 ? "ClientOnboardingItem OK" : "npm run db:deploy"
  );
}

// --- Manuale ops ---
for (const [num, id, label] of [
  [1, "git-push", "push GitHub"],
  [2, "supabase-r2", "console Supabase + R2"],
  [6, "seed-passwords", "password reali post-seed"],
  [11, "dns", "Hostinger / Vercel"],
  [14, "admin-upload", "login + upload post-deploy"],
  [18, "webhook-test", "/admin/webhooks"],
]) {
  set(num, id, "manual", label);
}

for (const num of [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]) {
  set(num, `opt-${num}`, "manual", "opzionale");
}

const results = [...byNum.values()].sort((a, b) => a.num - b.num);
const done = results.filter((r) => r.status === "done").length;
const todo = results.filter((r) => r.status === "todo").length;
const manual = results.filter((r) => r.status === "manual").length;
const warn = results.filter((r) => r.status === "warn").length;

console.log("\n=== Passi mancanti — check automatico ===\n");
console.log(`Fatto: ${done} · Todo env: ${todo} · Avvisi: ${warn} · Manuale ops: ${manual}\n`);

for (const r of results) {
  const icon =
    r.status === "done" ? "✓" : r.status === "todo" ? "✗" : r.status === "warn" ? "⚠" : "○";
  console.log(
    `  ${icon} #${String(r.num).padStart(2, "0")} [${r.status}] ${r.id}${r.detail ? ` — ${r.detail}` : ""}`
  );
}

if (deploy.status !== 0 && deployOut) {
  console.log("\n--- deploy-check ---\n");
  console.log(deployOut.slice(-1200));
}

console.log("\nDocumento: PASSI-MANCANTI.md · Live: /admin/go-live\n");
process.exit(todo > 0 ? 1 : 0);
