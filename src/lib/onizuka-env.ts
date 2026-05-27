export type OnizukaEnvLabel = "production" | "staging" | "preview" | "development";

/** Etichetta ambiente esplicita (ONIZUKA_ENV) o inferita da Vercel/NODE_ENV. */
export function getOnizukaEnv(): OnizukaEnvLabel {
  const explicit = process.env.ONIZUKA_ENV?.trim().toLowerCase();
  if (explicit === "staging") return "staging";
  if (explicit === "production") return "production";
  const vercel = process.env.VERCEL_ENV?.trim();
  if (vercel === "production") return "production";
  if (vercel === "preview") return "preview";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

/** Avvisa se staging punta a un DB che non contiene il marker atteso. */
export function stagingDatabaseMismatchWarning(): string | null {
  if (getOnizukaEnv() !== "staging") return null;
  const marker = process.env.ONIZUKA_STAGING_DB_MARKER?.trim();
  if (!marker) return null;
  const db = process.env.DATABASE_URL?.toLowerCase() ?? "";
  if (!db || db.includes("localhost") || db.includes("127.0.0.1")) return null;
  if (db.includes(marker.toLowerCase())) return null;
  return `DATABASE_URL non contiene ONIZUKA_STAGING_DB_MARKER (${marker}): rischio DB di produzione.`;
}
