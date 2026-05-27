import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { notifyReferrerPush } from "@/lib/referrer-web-push";

/** Email al segnalatore quando arriva un lead dal portale (best-effort, richiede SMTP). */
export async function notifyReferrerNewLeadFromPortal(params: {
  referrerEmail: string;
  referrerName: string;
  leadTitle: string;
}): Promise<void> {
  if (!isSmtpConfigured()) return;
  const base =
    process.env.ONIZUKA_PRIMARY_HOST?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "";
  const text = [
    `Ciao ${params.referrerName},`,
    "",
    `Abbiamo ricevuto un nuovo lead dal tuo link: «${params.leadTitle}».`,
    "",
    base ? `Area interna agenzia: ${base}/admin/crm/leads` : "L’agenzia ti aggiornerà sullo stato del lead.",
    "",
    "— Onizuka",
  ].join("\n");

  void sendEmailViaSmtp({
    to: params.referrerEmail.trim(),
    subject: "[Onizuka] Nuovo lead dal portale segnalatore",
    text,
  }).catch(() => {});
}

/** Email al segnalatore quando una liquidazione passa a pagata. */
export async function notifyReferrerPayoutPaid(params: {
  referrerId: string;
  referrerEmail: string;
  referrerName: string;
  amountEur: string;
  periodLabel: string | null;
}): Promise<void> {
  if (!isSmtpConfigured()) return;
  const period = params.periodLabel ? ` (${params.periodLabel})` : "";
  const text = [
    `Ciao ${params.referrerName},`,
    "",
    `La liquidazione provvigioni${period} di € ${params.amountEur} risulta pagata.`,
    "",
    "Accedi al portale segnalatore con il tuo link e PIN per i dettagli.",
    "",
    "— Onizuka",
  ].join("\n");

  void sendEmailViaSmtp({
    to: params.referrerEmail.trim(),
    subject: "[Onizuka] Liquidazione provvigioni pagata",
    text,
  }).catch(() => {});

  void notifyReferrerPush({
    referrerId: params.referrerId,
    title: "Liquidazione pagata",
    body: `€ ${params.amountEur}${period}`,
  }).catch(() => {});
}
