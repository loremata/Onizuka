import { prisma } from "@/lib/prisma";
import { sendGmailViaApi } from "@/lib/gmail-api";
import { isGmailConnected } from "@/lib/gmail-oauth";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { markOutreachDraftSent } from "@/lib/outreach-sent";
import { wrapOutreachHtmlBody } from "@/lib/outreach-tracking";
import { pickOutreachBody, pickOutreachSubject } from "@/lib/outreach-ab";
import { resolveReachAbVariantForSend } from "@/lib/reach-ab-default";

export type OutreachSendResult = {
  sent: boolean;
  to?: string;
  channel?: "gmail" | "smtp";
  note: string;
};

/**
 * Invia subito una bozza outreach via Gmail API (se connesso) o SMTP, e la marca
 * come SENT (con lo step di sequenza collegato). Funzione condivisa tra approvazione
 * manuale (Telegram/Reach) e auto-invio dei follow-up. Destinatario: email del
 * cliente o, in mancanza, del lead.
 */
export async function sendOutreachDraftNow(draftId: string): Promise<OutreachSendResult> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    include: {
      client: { select: { contactEmail: true } },
      lead: { select: { email: true } },
    },
  });
  if (!draft) return { sent: false, note: "Bozza non trovata." };
  // Difesa anti doppio-invio: una bozza già inviata/annullata non si rispedisce.
  if (draft.status === "SENT" || draft.status === "CANCELLED") {
    return { sent: false, note: `Bozza già processata (${draft.status}).` };
  }

  const to = (draft.client?.contactEmail ?? draft.lead?.email ?? "").trim();
  if (!to) return { sent: false, note: "Nessuna email destinatario." };
  // Prospect da Sheet senza contatto reale: email segnaposto interna → mai inviare.
  if (/@onizuka\.local$/i.test(to) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { sent: false, to, note: "Email segnaposto/non valida — usa WhatsApp o chiamata." };
  }

  const abVariant = await resolveReachAbVariantForSend(draft.ownerUserId, undefined);
  const subject = pickOutreachSubject(draft, abVariant);
  const emailBody = pickOutreachBody(draft, abVariant);
  const html = wrapOutreachHtmlBody(emailBody, draft.id);

  if (await isGmailConnected(draft.ownerUserId)) {
    const viaApi = await sendGmailViaApi(draft.ownerUserId, { to, subject, text: emailBody, html });
    if (viaApi.ok) {
      await markOutreachDraftSent(draftId, draft.ownerUserId, { abVariantSent: abVariant });
      return { sent: true, to, channel: "gmail", note: `Inviata via Gmail a ${to} (variante ${abVariant}).` };
    }
    return { sent: false, to, note: "Invio Gmail fallito." };
  }

  if (isSmtpConfigured()) {
    const res = await sendEmailViaSmtp({ to, subject, text: emailBody, html });
    if (res.ok) {
      await markOutreachDraftSent(draftId, draft.ownerUserId, { abVariantSent: abVariant });
      return { sent: true, to, channel: "smtp", note: `Inviata via SMTP a ${to} (variante ${abVariant}).` };
    }
    return { sent: false, to, note: `SMTP: ${res.error}` };
  }

  return { sent: false, to, note: "Nessun canale email configurato." };
}
