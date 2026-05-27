#!/usr/bin/env node
/**
 * Prepara .env.local per dev Docker: CRON_SECRET + ALLOW_LOCAL_UPLOAD_SERVE.
 * Dopo l'esecuzione: riavvia `npm run dev` per caricare le nuove variabili.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDotEnvFiles } from "./load-dotenv.mjs";

const root = process.cwd();
const localPath = join(root, ".env.local");

loadDotEnvFiles(root);

/** @param {string[]} lines */
function upsert(lines, key, value) {
  const re = new RegExp(`^${key}=`);
  let found = false;
  const next = lines.map((line) => {
    if (re.test(line.trim())) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  return next;
}

let lines = existsSync(localPath)
  ? readFileSync(localPath, "utf8").split("\n").filter((l, i, a) => i < a.length - 1 || l.length > 0)
  : ["# Generato da npm run local:setup — override di .env in dev"];

const changes = [];

if (!process.env.CRON_SECRET?.trim()) {
  const secret = randomBytes(32).toString("hex");
  lines = upsert(lines, "CRON_SECRET", secret);
  changes.push("CRON_SECRET");
}

if (process.env.ALLOW_LOCAL_UPLOAD_SERVE !== "1") {
  lines = upsert(lines, "ALLOW_LOCAL_UPLOAD_SERVE", "1");
  changes.push("ALLOW_LOCAL_UPLOAD_SERVE");
}

if (changes.length === 0) {
  console.log("\n.env.local già completo (CRON_SECRET + ALLOW_LOCAL_UPLOAD_SERVE).\n");
  process.exit(0);
}

writeFileSync(localPath, `${lines.join("\n").trimEnd()}\n`, "utf8");
console.log(`\n✓ Aggiornato ${localPath}: ${changes.join(", ")}`);
console.log("  Riavvia il server dev: Ctrl+C su npm run dev, poi npm run dev");
console.log("  Poi: npm run passi-mancanti:local\n");
