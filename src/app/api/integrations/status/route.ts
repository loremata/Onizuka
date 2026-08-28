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

  // Indirizzi dell'outreach. Le variabili su Vercel sono "sensitive": una volta
  // scritte nessuno può più rileggerle, nemmeno dal pannello. Ma il mittente non
  // è un segreto — sta in cima a ogni mail che parte — e serve saperlo per una
  // ragione precisa: le risposte tornano al MITTENTE, mentre il watcher IMAP
  // legge la casella dell'utente SMTP. Se i due indirizzi non coincidono, le
  // risposte finiscono dove nessuno le guarda e lo stop-on-reply non scatta mai.
  const mittente = process.env.GMAIL_SMTP_FROM?.trim() || process.env.GMAIL_SMTP_USER?.trim() || null;
  const casellaRisposte =
    process.env.OUTREACH_IMAP_USER?.trim() || process.env.GMAIL_SMTP_USER?.trim() || null;
  const soloIndirizzo = (v: string | null) => v?.match(/[^<>\s"]+@[^<>\s"]+/)?.[0]?.toLowerCase() ?? v;

  return NextResponse.json({
    outreachFrom: soloIndirizzo(mittente),
    outreachInbox: soloIndirizzo(casellaRisposte),
    outreachReplyMismatch:
      Boolean(mittente && casellaRisposte) && soloIndirizzo(mittente) !== soloIndirizzo(casellaRisposte),
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
