import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} line
 */
function applyLine(line, override) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return;
  const i = t.indexOf("=");
  if (i < 1) return;
  const key = t.slice(0, i).trim();
  let val = t.slice(i + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (override || process.env[key] === undefined) {
    process.env[key] = val;
  }
}

/**
 * @param {string} [root]
 * @param {{ override?: boolean }} [opts]
 */
export function loadEnvFile(root, filename, opts = {}) {
  const path = join(root ?? process.cwd(), filename);
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    applyLine(line, Boolean(opts.override));
  }
  return true;
}

/** `.env` poi `.env.local` (override). */
export function loadDotEnvFiles(root = process.cwd()) {
  loadEnvFile(root, ".env", { override: false });
  loadEnvFile(root, ".env.local", { override: true });
}
