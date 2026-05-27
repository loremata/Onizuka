import { getDeployCapabilities } from "@/lib/deploy-capabilities";
import { isGmailOAuthConfigured } from "@/lib/gmail-oauth";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar-oauth";
import { isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";
import { isLlmConfigured } from "@/lib/llm-client";
import { isNotificationBusEnabled } from "@/lib/notification-bus";
import { isTelegramConfigured } from "@/lib/telegram-bot";
import { isGbpBusinessOAuthConfigured } from "@/lib/gbp-business-oauth";
import { isSdiBridgeConfigured } from "@/lib/finance-sdi";
import { isStripeConfigured } from "@/lib/stripe-client";
import { isMemoryEncryptionEnabled, isMemoryKeyRotationConfigured } from "@/lib/memory-crypto";
import { isPgvectorConfigured } from "@/lib/memory-pgvector";
import { isMemoryVaultPinConfigured } from "@/lib/memory-vault";
import { isElevenLabsTtsConfigured } from "@/lib/voice-tts-elevenlabs";
import { resolveAuditSheetCsvUrl } from "@/lib/audit-sheet-ingest";
import { isGoogleSheetsAuditApiConfigured } from "@/lib/google-sheets-audit";
import { isDedupeGpuWebhookEnabled } from "@/lib/dedupe-training-gpu";
import { isMetaNativePublishConfigured } from "@/lib/social-publish-meta";
import { isLinkedInNativePublishConfigured } from "@/lib/social-publish-linkedin";
import { isSupabaseCloudProvisionEnabled } from "@/lib/workspace-cloud-supabase";

export type ReadinessItem = {
  id: string;
  label: string;
  status: "done" | "optional" | "todo";
  hint?: string;
};

/** Checklist go-live lato codice (non sostituisce deploy operativo). */
export function buildProductionReadinessChecklist(): ReadinessItem[] {
  const caps = getDeployCapabilities();

  return [
    {
      id: "auth",
      label: "NEXTAUTH_URL + SECRET",
      status:
        Boolean(process.env.NEXTAUTH_SECRET?.trim()) &&
        process.env.NEXTAUTH_SECRET!.length >= 32 &&
        Boolean(process.env.NEXTAUTH_URL?.trim())
          ? "done"
          : "todo",
    },
    {
      id: "db",
      label: "DATABASE_URL (Supabase pooler)",
      status: Boolean(process.env.DATABASE_URL?.trim()) ? "done" : "todo",
      hint: "Porta 6543 runtime",
    },
    {
      id: "direct-url",
      label: "DIRECT_URL (migrate deploy)",
      status: Boolean(process.env.DIRECT_URL?.trim()) ? "done" : "todo",
      hint: "Porta 5432 — obbligatoria per migrate deploy / CI",
    },
    {
      id: "storage",
      label: "Storage S3/R2",
      status:
        caps.storage === "s3"
          ? "done"
          : process.env.VERCEL_ENV === "production" &&
              process.env.ALLOW_LOCAL_UPLOAD_SERVE === "1"
            ? "todo"
            : caps.storage === "local"
              ? "optional"
              : "todo",
      hint:
        process.env.VERCEL_ENV === "production" &&
        process.env.ALLOW_LOCAL_UPLOAD_SERVE === "1"
          ? "Disabilita ALLOW_LOCAL_UPLOAD_SERVE in produzione"
          : undefined,
    },
    {
      id: "cron",
      label: "CRON_SECRET + cron Vercel",
      status: caps.cron ? "done" : "todo",
    },
    {
      id: "smtp",
      label: "SMTP email",
      status: caps.smtp ? "done" : "optional",
    },
    {
      id: "n8n",
      label: "N8N_API_KEY",
      status: caps.n8n ? "done" : "optional",
    },
    {
      id: "upstash",
      label: "Upstash (rate limit + bus notifiche)",
      status: caps.upstashLoginRateLimit ? "done" : "optional",
      hint: isNotificationBusEnabled() ? "Bus notifiche attivo" : "Solo DB rev senza bus",
    },
    {
      id: "calendar",
      label: "Google Calendar OAuth",
      status: isGoogleCalendarConfigured() ? "done" : "optional",
    },
    {
      id: "gmail",
      label: "Gmail OAuth",
      status: isGmailOAuthConfigured() ? "done" : "optional",
    },
    {
      id: "drive",
      label: "Google Drive service account",
      status: isGoogleDriveServiceAccountConfigured() ? "done" : "optional",
    },
    {
      id: "telegram",
      label: "Telegram bot",
      status: isTelegramConfigured() ? "done" : "optional",
    },
    {
      id: "llm",
      label: "OPENAI_API_KEY (assistente)",
      status: isLlmConfigured() ? "done" : "optional",
    },
    {
      id: "tts-elevenlabs",
      label: "ElevenLabs TTS (VOICE_TTS_PROVIDER)",
      status: isElevenLabsTtsConfigured() ? "done" : "optional",
      hint: "ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID",
    },
    {
      id: "memory-crypto",
      label: "ONIZUKA_MEMORY_ENCRYPTION_KEY",
      status: isMemoryEncryptionEnabled() ? "done" : "optional",
    },
    {
      id: "memory-vault-pin",
      label: "ONIZUKA_MEMORY_VAULT_PIN (export sensibili)",
      status: isMemoryVaultPinConfigured() ? "done" : "optional",
      hint: "Consigliato in produzione se il vault è attivo",
    },
    {
      id: "memory-key-rotation",
      label: "Rotazione chiave vault (KEY_PREVIOUS)",
      status: isMemoryKeyRotationConfigured() ? "done" : "optional",
      hint: "ONIZUKA_MEMORY_ENCRYPTION_KEY_PREVIOUS per decrypt legacy",
    },
    {
      id: "pgvector",
      label: "pgvector (ONIZUKA_PGVECTOR)",
      status: isPgvectorConfigured() ? "done" : "optional",
    },
    {
      id: "gbp-oauth",
      label: "Google Business Profile OAuth",
      status: isGbpBusinessOAuthConfigured() ? "done" : "optional",
    },
    {
      id: "sdi",
      label: "Bridge SDI (ONIZUKA_SDI_ENDPOINT)",
      status: isSdiBridgeConfigured() ? "done" : "optional",
    },
    {
      id: "stripe",
      label: "Stripe pagamenti",
      status: isStripeConfigured() ? "done" : "optional",
    },
    {
      id: "audit-sheet",
      label: "Google Sheet audit (CSV o Sheets API)",
      status:
        resolveAuditSheetCsvUrl() || isGoogleSheetsAuditApiConfigured() ? "done" : "optional",
      hint: "GOOGLE_SHEET_AUDIT_* + opz. GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON",
    },
    {
      id: "dedupe-gpu",
      label: "Dedupe GPU webhook",
      status: isDedupeGpuWebhookEnabled() ? "done" : "optional",
      hint: "scripts/dedupe-gpu-worker",
    },
    {
      id: "meta-publish",
      label: "Meta publish nativo",
      status: isMetaNativePublishConfigured() ? "done" : "optional",
    },
    {
      id: "linkedin-publish",
      label: "LinkedIn publish nativo",
      status: isLinkedInNativePublishConfigured() ? "done" : "optional",
    },
    {
      id: "supabase-cloud",
      label: "Supabase tenant provision",
      status: isSupabaseCloudProvisionEnabled() ? "done" : "optional",
      hint: "SUPABASE_MAX_ACTIVE_PROJECTS",
    },
    {
      id: "dns",
      label: "DNS onizuka.it → Vercel",
      status: "todo",
      hint: "Operativo su Hostinger / Vercel Domains",
    },
  ];
}
