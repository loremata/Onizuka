import { getOnizukaEnv, stagingDatabaseMismatchWarning } from "@/lib/onizuka-env";

/** Host applicativi considerati produzione (non usare per staging/E2E). */
const PRODUCTION_APP_HOSTS = ["onizuka.it", "www.onizuka.it"];

/** Pattern nel DATABASE_URL che indicano produzione. */
const PRODUCTION_DB_HINTS = ["onizuka.it", "prod.onizuka", "/production", "production."];

export type StagingGuardOptions = {
  /** Richiede ONIZUKA_ENV=staging (script migrate/seed remoti). */
  requireStagingEnv?: boolean;
  /** Richiede ONIZUKA_STAGING_CONFIRM=yes per operazioni distruttive. */
  requireConfirm?: boolean;
};

function normalizeHost(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function isProductionAppHost(hostOrUrl: string): boolean {
  const host = normalizeHost(hostOrUrl);
  if (host.includes("staging") || host.endsWith(".vercel.app")) return false;
  return host === "onizuka.it" || host === "www.onizuka.it";
}

export function isStagingAppHost(hostOrUrl: string): boolean {
  const host = normalizeHost(hostOrUrl);
  if (host === "localhost" || host === "127.0.0.1") return true;
  return host.includes("staging") || host.includes("-staging") || host.endsWith(".vercel.app");
}

export function isProductionDatabaseUrl(databaseUrl?: string): boolean {
  const db = (databaseUrl ?? process.env.DATABASE_URL ?? "").toLowerCase();
  if (!db) return false;
  if (getOnizukaEnv() === "production") return true;
  return PRODUCTION_DB_HINTS.some((hint) => db.includes(hint));
}

/** Blocca DATABASE_URL / NEXTAUTH_URL che sembrano produzione. */
export function assertNotProductionDatabase(message = "Operazione rifiutata: DATABASE_URL sembra produzione.") {
  if (isProductionDatabaseUrl()) {
    throw new Error(message);
  }
  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl && isProductionAppHost(authUrl)) {
    throw new Error("NEXTAUTH_URL punta alla produzione. Usa URL staging dedicato.");
  }
}

/** Gate per script staging remoti (migrate, seed, cleanup). */
export function assertStagingEnvironment(opts: StagingGuardOptions = {}) {
  const { requireStagingEnv = true, requireConfirm = false } = opts;

  assertNotProductionDatabase();

  if (requireStagingEnv && getOnizukaEnv() !== "staging") {
    throw new Error(
      'ONIZUKA_ENV deve essere "staging" per questo script. Imposta ONIZUKA_ENV=staging nel progetto Vercel staging o in .env.staging.'
    );
  }

  const marker = process.env.ONIZUKA_STAGING_DB_MARKER?.trim();
  if (requireStagingEnv && !marker) {
    throw new Error(
      "ONIZUKA_STAGING_DB_MARKER obbligatorio (ref Supabase staging, es. abcdef da db.abcdef.supabase.co)."
    );
  }

  const dbWarn = stagingDatabaseMismatchWarning();
  if (dbWarn) {
    throw new Error(dbWarn);
  }

  const authUrl = process.env.NEXTAUTH_URL?.trim();
  if (authUrl && isProductionAppHost(authUrl)) {
    throw new Error("NEXTAUTH_URL non può puntare a onizuka.it in staging.");
  }

  if (requireConfirm && process.env.ONIZUKA_STAGING_CONFIRM?.trim().toLowerCase() !== "yes") {
    throw new Error(
      'Conferma esplicita richiesta: imposta ONIZUKA_STAGING_CONFIRM=yes (es. ONIZUKA_STAGING_CONFIRM=yes npm run staging:migrate).'
    );
  }
}

/** E2E: mai contro produzione; remoto solo host staging/vercel. */
export function assertSafeE2EBaseUrl(baseUrl?: string) {
  const base = (baseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").trim();
  if (!base) {
    throw new Error("PLAYWRIGHT_BASE_URL mancante.");
  }
  if (isProductionAppHost(base)) {
    throw new Error("PLAYWRIGHT_BASE_URL non può puntare a onizuka.it (produzione).");
  }
  const host = normalizeHost(base);
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (!isLocal && !isStagingAppHost(base)) {
    throw new Error(
      `PLAYWRIGHT_BASE_URL (${host}) non è localhost né host staging riconosciuto. Usa *.vercel.app staging o staging.onizuka.it.`
    );
  }
}

export function isRemotePlaywrightBase(baseUrl?: string): boolean {
  const base = (baseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? "").trim();
  if (!base) return false;
  const host = normalizeHost(base);
  return host !== "localhost" && host !== "127.0.0.1";
}

/** Gate commerciale: blocca produzione; in staging richiede marker se ONIZUKA_ENV=staging. */
export function assertCommercialGateSafe() {
  assertNotProductionDatabase();
  if (getOnizukaEnv() === "staging") {
    assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: false });
  }
}
