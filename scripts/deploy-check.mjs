#!/usr/bin/env node
/**
 * Valida variabili d'ambiente per deploy Vercel + Supabase + onizuka.it.
 * Uso: node --env-file=.env scripts/deploy-check.mjs
 */

const errors = [];
const warnings = [];
const successes = [];

function env(name) {
  return process.env[name]?.trim() ?? "";
}

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function pass(msg) {
  successes.push(msg);
}

// Auth
const nextAuthUrl = env("NEXTAUTH_URL");
const nextAuthSecret = env("NEXTAUTH_SECRET");

if (!nextAuthUrl) fail("NEXTAUTH_URL mancante");
else if (!nextAuthUrl.startsWith("https://")) warn("NEXTAUTH_URL non usa https:// (ok solo in locale)");
else pass(`NEXTAUTH_URL=${nextAuthUrl}`);

if (!nextAuthSecret || nextAuthSecret.length < 32) fail("NEXTAUTH_SECRET assente o < 32 caratteri");
else pass("NEXTAUTH_SECRET impostato");

if (env("ONIZUKA_PRIMARY_HOST")) pass(`ONIZUKA_PRIMARY_HOST=${env("ONIZUKA_PRIMARY_HOST")}`);
else warn("ONIZUKA_PRIMARY_HOST non impostato (redirect www→apex disabilitato)");

// Database
const dbUrl = env("DATABASE_URL");
const directUrl = env("DIRECT_URL");

if (!dbUrl) fail("DATABASE_URL mancante");
else {
  const lower = dbUrl.toLowerCase();
  if (lower.includes("supabase")) {
    const pooled =
      lower.includes("pooler.supabase.com") ||
      lower.includes(":6543/") ||
      lower.includes("pgbouncer=true");
    if (!pooled) warn("DATABASE_URL Supabase: usa Transaction pooler (porta 6543) su Vercel");
    else pass("DATABASE_URL Supabase pooler");
    if (!directUrl) warn("DIRECT_URL mancante (serve per prisma migrate deploy)");
    else pass("DIRECT_URL impostata");
  } else pass("DATABASE_URL impostata");
}

// Storage
const s3Ok = env("S3_BUCKET") && env("S3_ACCESS_KEY") && env("S3_SECRET_KEY");
const localOk = env("ALLOW_LOCAL_UPLOAD_SERVE") === "1";

if (s3Ok) pass("Storage S3/R2 configurato");
else if (localOk) {
  warn("ALLOW_LOCAL_UPLOAD_SERVE=1 (solo VPS, non Vercel)");
  if (nextAuthUrl.includes("onizuka.it") || process.env.VERCEL_ENV === "production") {
    fail("In produzione onizuka.it usa S3/R2, non ALLOW_LOCAL_UPLOAD_SERVE");
  }
} else fail("Storage: imposta S3_* oppure ALLOW_LOCAL_UPLOAD_SERVE=1 (VPS)");

// Cron
if (!env("CRON_SECRET")) warn("CRON_SECRET mancante");
else pass("CRON_SECRET impostato");

// SMTP
const smtp = env("GMAIL_SMTP_HOST") && env("GMAIL_SMTP_USER") && env("GMAIL_SMTP_PASSWORD");
if (smtp) pass("SMTP configurato");
else warn("SMTP non configurato (digest/ticket/preventivi email disabilitati)");

if (env("N8N_API_KEY")) pass("N8N_API_KEY impostata");
else warn("N8N_API_KEY mancante");

if (env("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON")) pass("Google Drive service account configurato");
else warn("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON mancante (creazione cartelle automatica disabilitata)");

if (env("UPSTASH_REDIS_REST_URL") && env("UPSTASH_REDIS_REST_TOKEN")) pass("Upstash Redis configurato");
else warn("Upstash non configurato (rate limit login in-memory su Vercel)");

if (env("OPENAI_API_KEY")) pass("OPENAI_API_KEY impostata (assistente AI)");
else warn("OPENAI_API_KEY mancante (assistente usa solo regole + memoria)");

console.log("\n--- Deploy check Onizuka ---\n");
successes.forEach((s) => console.log(`  ✓ ${s}`));

if (warnings.length) {
  console.log("\nAvvisi:");
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}

if (errors.length) {
  console.log("\nErrori:");
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log("\nDeploy NON pronto. Vedi docs/DEPLOY.md\n");
  process.exit(1);
}

console.log("\nTutti i controlli obbligatori superati.");
console.log("Prossimo: npm run db:deploy (con DIRECT_URL) → deploy Vercel → DNS Hostinger\n");
