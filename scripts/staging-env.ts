import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Carica .env, .env.local, .env.staging (senza sovrascrivere env già impostate). */
export function loadStagingEnvFiles() {
  const root = process.cwd();
  const load = (name: string, override: boolean) => {
    const path = join(root, name);
    if (!existsSync(path)) return false;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
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
    return true;
  };
  load(".env", false);
  load(".env.local", true);
  const hasStaging = load(".env.staging", false);
  if (!hasStaging && process.env.ONIZUKA_ENV !== "staging") {
    console.warn("WARN: .env.staging assente — imposta env manualmente o copia da .env.staging.example");
  }
}
