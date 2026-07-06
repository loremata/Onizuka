import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeployCapabilities } from "@/lib/deploy-capabilities";
import { isSmtpConfigured } from "@/lib/smtp-send";
import { isWhatsAppConfigured } from "@/lib/whatsapp-cloud";
import { isPageSpeedConfigured } from "@/lib/audit/pagespeed";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const caps = getDeployCapabilities();

  return NextResponse.json({
    googleCalendar: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID),
    gmail: Boolean(process.env.GMAIL_CLIENT_ID),
    gmailSmtp: isSmtpConfigured(),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    pagespeed: isPageSpeedConfigured(),
    voiceTts: process.env.VOICE_TTS_PROVIDER ?? null,
    n8n: caps.n8n,
    storage: caps.storage,
    cron: caps.cron,
    upstashLoginRateLimit: caps.upstashLoginRateLimit,
    redisApiRateLimit: caps.redisApiRateLimit,
    whatsapp: isWhatsAppConfigured(),
  });
}
