import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";
import { notifyAdminsViaWebPush } from "@/lib/admin-web-push";

/**
 * Notifica in tempo reale all'admin di un nuovo lead entrato dai form pubblici
 * (configuratore risparmio, preventivatore digitale, walk-in negozio).
 *
 * Best-effort e fail-safe: qualsiasi errore qui NON deve mai rompere la creazione
 * del lead né la submission pubblica. Chi chiama deve comunque usare `.catch(()=>{})`,
 * ma anche internamente ogni canale è protetto e l'assenza di config è un no-op silenzioso.
 */

type InboundSource = "configuratore" | "preventivatore" | "walkin";

const SOURCE_LABEL: Record<InboundSource, string> = {
  configuratore: "Configuratore risparmio",
  preventivatore: "Preventivatore digitale",
  walkin: "Walk-in negozio",
};

export type NotifyInboundLeadParams = {
  /** Origine del lead: determina l'etichetta mostrata all'admin. */
  source: InboundSource;
  /** Id del Lead creato, per costruire il link alla scheda in Onizuka. */
  leadId?: string;
  businessName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  /** Riassunto testuale della simulazione compilata (servizi/stima, obiettivi/pacchetto, esigenza…). */
  payloadSummary?: string | null;
};

/** Base URL pubblico dell'app (stesso pattern usato altrove nel repo). */
function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
}

/**
 * Destinatario email dell'alert admin: prima un override esplicito via env,
 * poi l'utente/mittente SMTP, infine l'email del primo utente ADMIN.
 */
async function resolveAdminEmail(): Promise<string | null> {
  const override = process.env.ONIZUKA_ADMIN_ALERT_EMAIL?.trim();
  if (override) return override;
  const smtpUser = process.env.GMAIL_SMTP_USER?.trim();
  if (smtpUser) return smtpUser;
  try {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    return admin?.email ?? null;
  } catch {
    return null;
  }
}

function buildLines(params: NotifyInboundLeadParams): string[] {
  const label = SOURCE_LABEL[params.source];
  const leadUrl = params.leadId ? `${appBaseUrl()}/admin/crm/leads/${params.leadId}/edit` : null;

  return [
    `Nuovo lead · ${label}`,
    "",
    params.businessName ? `Azienda: ${params.businessName}` : "",
    params.contactName ? `Contatto: ${params.contactName}` : "",
    params.phone ? `Telefono: ${params.phone}` : "",
    params.email ? `Email: ${params.email}` : "",
    params.city ? `Città: ${params.city}` : "",
    params.payloadSummary ? `\nRichiesta: ${params.payloadSummary}` : "",
    leadUrl ? `\nScheda lead: ${leadUrl}` : "",
  ].filter(Boolean);
}

/**
 * Invia la notifica su tutti i canali configurati (Telegram + email), in parallelo.
 * Ogni canale è indipendente: se Telegram o SMTP non sono configurati è un no-op silenzioso.
 */
export async function notifyInboundLead(params: NotifyInboundLeadParams): Promise<void> {
  const lines = buildLines(params);
  const text = lines.join("\n");

  const tasks: Promise<unknown>[] = [];

  // Canale Telegram: no-op interno se TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_IDS mancano.
  tasks.push(
    notifyAdminsViaTelegram(text).catch((e) => {
      console.warn("[lead-inbound-notify] telegram", e);
    })
  );

  // Canale Web Push: no-op interno se le chiavi VAPID mancano. La notifica
  // porta a /admin/m/lead, dove il contatto si chiama con un tocco: è l'unico
  // canale dei tre che arriva sul telefono senza aprire nulla.
  tasks.push(
    notifyAdminsViaWebPush({
      title: `Nuovo lead · ${SOURCE_LABEL[params.source]}`,
      body:
        [params.businessName ?? params.contactName, params.city, params.phone]
          .filter(Boolean)
          .join(" · ") || "Apri per i dettagli",
      url: "/admin/m/lead",
    }).catch((e) => {
      console.warn("[lead-inbound-notify] webpush", e);
    })
  );

  // Canale email: solo se SMTP è configurato e abbiamo un destinatario admin.
  if (isSmtpConfigured()) {
    tasks.push(
      (async () => {
        const to = await resolveAdminEmail();
        if (!to) {
          console.warn("[lead-inbound-notify] nessun destinatario admin per email");
          return;
        }
        const res = await sendEmailViaSmtp({
          to,
          subject: `[Onizuka] Nuovo lead · ${SOURCE_LABEL[params.source]}`,
          text,
        });
        if (!res.ok) console.warn("[lead-inbound-notify] email", res.error);
      })().catch((e) => {
        console.warn("[lead-inbound-notify] email", e);
      })
    );
  }

  await Promise.allSettled(tasks);
}
