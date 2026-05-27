import { isNotificationBusEnabled } from "@/lib/notification-bus";
import { isGoogleDriveServiceAccountConfigured } from "@/lib/google-drive-service";
import { isSmtpConfigured } from "@/lib/smtp-send";
import { isS3Configured } from "@/lib/storage";

/** Flag non sensibili per /api/health/ready (operatori / monitoring). */
export function getDeployCapabilities() {
  return {
    storage: isS3Configured() ? "s3" : process.env.ALLOW_LOCAL_UPLOAD_SERVE === "1" ? "local" : "none",
    smtp: isSmtpConfigured(),
    cron: Boolean(process.env.CRON_SECRET?.trim()),
    n8n: Boolean(process.env.N8N_API_KEY?.trim()),
    upstashLoginRateLimit: Boolean(
      process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
    ),
    redisApiRateLimit: Boolean(process.env.REDIS_URL?.trim()),
    primaryHost: process.env.ONIZUKA_PRIMARY_HOST?.trim() ?? null,
    googleDriveApi: isGoogleDriveServiceAccountConfigured(),
    llm: Boolean(process.env.OPENAI_API_KEY?.trim()),
    marketingUrl: process.env.ONIZUKA_MARKETING_URL?.trim() ?? null,
    notificationBus: isNotificationBusEnabled(),
  };
}
