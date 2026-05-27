#!/usr/bin/env node
/**
 * Report variabili go-live vs vercel-env.template (nessun valore stampato).
 * Uso: node --env-file=.env.production scripts/bootstrap-production.mjs
 *      npm run bootstrap:prod
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = join(root, "vercel-env.template");

function env(name) {
  return process.env[name]?.trim() ?? "";
}

function parseTemplateKeys(text) {
  const keys = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) keys.push(key);
  }
  return [...new Set(keys)];
}

let templateKeys = [];
try {
  templateKeys = parseTemplateKeys(readFileSync(templatePath, "utf8"));
} catch {
  console.error("vercel-env.template non trovato.");
  process.exit(1);
}

const required = [
  "NEXTAUTH_URL",
  "NEXTAUTH_SECRET",
  "DATABASE_URL",
  "DIRECT_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "CRON_SECRET",
];

const optional = templateKeys.filter((k) => !required.includes(k));

const missingRequired = required.filter((k) => !env(k));
const missingOptional = optional.filter((k) => !env(k));
const setRequired = required.length - missingRequired.length;

console.log("\n=== Onizuka bootstrap produzione ===\n");
console.log(`Obbligatori: ${setRequired}/${required.length}`);
if (missingRequired.length) {
  console.log("\nMancanti (obbligatori):");
  for (const k of missingRequired) console.log(`  - ${k}`);
} else {
  console.log("Tutti gli obbligatori del template sono impostati nel processo corrente.");
}

if (missingOptional.length && missingOptional.length <= 12) {
  console.log(`\nOpzionali non impostati (${missingOptional.length}): ${missingOptional.join(", ")}`);
} else if (missingOptional.length) {
  console.log(`\nOpzionali non impostati: ${missingOptional.length} (vedi vercel-env.template)`);
}

console.log("\nProssimi passi:");
console.log("  1. DIRECT_URL → npm run db:deploy");
console.log("  2. Deploy Vercel → npm run deploy:verify");
console.log("  3. /admin/go-live → checklist senza blocchi");
console.log("  4. npm run go-live per elenco completo\n");

process.exit(missingRequired.length ? 1 : 0);
