import { getDeployCapabilities } from "@/lib/deploy-capabilities";
import { getOnizukaEnv, stagingDatabaseMismatchWarning, type OnizukaEnvLabel } from "@/lib/onizuka-env";

export type DeployStatusReport = {
  environment: string;
  onizukaEnv: OnizukaEnvLabel;
  vercelEnv: string | null;
  appUrl: string | null;
  vercel: boolean;
  capabilities: ReturnType<typeof getDeployCapabilities>;
  issues: string[];
  warnings: string[];
  productionReady: boolean;
};

export function buildDeployStatusReport(): DeployStatusReport {
  const capabilities = getDeployCapabilities();
  const issues: string[] = [];
  const warnings: string[] = [];

  if (capabilities.storage === "none") {
    issues.push("Storage non configurato (S3/R2 o ALLOW_LOCAL_UPLOAD_SERVE).");
  }
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.ALLOW_LOCAL_UPLOAD_SERVE === "1"
  ) {
    issues.push(
      "ALLOW_LOCAL_UPLOAD_SERVE attivo in produzione: disabilita e configura S3/R2."
    );
  }
  if (!process.env.NEXTAUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET.length < 32) {
    issues.push("NEXTAUTH_SECRET assente o troppo corto.");
  }
  const appUrl = process.env.NEXTAUTH_URL?.trim() ?? null;
  if (!appUrl) {
    issues.push("NEXTAUTH_URL non impostato.");
  } else if (process.env.NODE_ENV === "production" && !appUrl.startsWith("https://")) {
    warnings.push("NEXTAUTH_URL non usa https:// in produzione.");
  }

  if (!capabilities.cron) warnings.push("CRON_SECRET mancante: cron notifiche non protetto.");
  if (!capabilities.smtp) warnings.push("SMTP non configurato: niente email digest/ticket/preventivi.");
  if (!capabilities.n8n) warnings.push("N8N_API_KEY mancante: API n8n disabilitate.");
  if (!capabilities.upstashLoginRateLimit && !capabilities.redisApiRateLimit) {
    warnings.push("Nessun Redis: rate limit login/API solo in-memory per istanza.");
    if (process.env.VERCEL_ENV === "production") {
      warnings.push(
        "Su Vercel produzione configura UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (vedi docs/DEPLOY.md)."
      );
    }
  }

  const dbUrl = process.env.DATABASE_URL?.toLowerCase() ?? "";
  if (dbUrl.includes("supabase") && !process.env.DIRECT_URL?.trim()) {
    warnings.push("DIRECT_URL mancante: migrate deploy da CI/locale può fallire.");
  }

  const vercelEnv = process.env.VERCEL_ENV?.trim() ?? null;
  const onizukaEnv = getOnizukaEnv();
  if (vercelEnv === "preview") {
    warnings.push("Ambiente Vercel Preview: usa variabili e DB separati dallo staging/produzione.");
  }
  if (onizukaEnv === "staging") {
    warnings.push("ONIZUKA_ENV=staging: verifica DATABASE_URL e NEXTAUTH_URL del progetto staging.");
  }
  const stagingDbWarn = stagingDatabaseMismatchWarning();
  if (stagingDbWarn) issues.push(stagingDbWarn);

  return {
    environment: vercelEnv ?? process.env.NODE_ENV ?? "development",
    onizukaEnv,
    vercelEnv,
    appUrl,
    vercel: Boolean(process.env.VERCEL),
    capabilities,
    issues,
    warnings,
    productionReady: issues.length === 0,
  };
}
