import { prisma } from "@/lib/prisma";
import { sendGmailViaApi } from "@/lib/gmail-api";
import { isGmailConnected } from "@/lib/gmail-oauth";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import { markOutreachDraftSent } from "@/lib/outreach-sent";
import { appendOutreachTextFooter, wrapOutreachHtmlBody } from "@/lib/outreach-tracking";
import { pickOutreachBody, pickOutreachSubject } from "@/lib/outreach-ab";
import { resolveReachAbVariantForSend } from "@/lib/reach-ab-default";
import { ensureClientOptOutToken, isEmailable } from "@/lib/campaigns/consent";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-link";
import { checkRecipientCooldown } from "@/lib/outreach-hygiene";
import { describeOutreachQuality, validateOutreachDraft } from "@/lib/outreach-quality";
import { buildMailtoUrl } from "@/lib/mailto-outreach";

/**
 * Riga sull'origine dei dati, richiesta dall'art. 14 GDPR quando il contatto non
 * è stato raccolto presso l'interessato (il caso di tutti i lead da scraping).
 * Personalizzabile con la env `REACH_DATA_SOURCE_NOTE`.
 */
const DATA_SOURCE_NOTE =
  process.env.REACH_DATA_SOURCE_NOTE?.trim() ||
  "Ti scriviamo da Online Station. Abbiamo reperito questo contatto tra le informazioni aziendali pubbliche; se preferisci non essere ricontattato usa il link qui sotto.";

export type OutreachSendResult = {
  sent: boolean;
  to?: string;
  channel?: "gmail" | "smtp";
  note: string;
  /**
   * Valorizzato solo quando non è configurato alcun canale automatico: contiene
   * il testo già completo di footer di disiscrizione e nota art. 14, così anche
   * l'invio a mano dal client di posta parte con le stesse garanzie.
   */
  mailto?: string;
  /** Oggetto e corpo effettivi (decorati), per precompilare l'invio manuale. */
  prepared?: { subject: string; body: string };
};

/**
 * Invia subito una bozza outreach via Gmail API (se connesso) o SMTP, e la marca
 * come SENT (con lo step di sequenza collegato). Funzione condivisa tra approvazione
 * manuale (Telegram/Reach) e auto-invio dei follow-up. Destinatario: email del
 * cliente o, in mancanza, del lead.
 */
export async function sendOutreachDraftNow(
  draftId: string,
  opts?: { auto?: boolean; prepareOnly?: boolean }
): Promise<OutreachSendResult> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    include: {
      client: {
        select: {
          id: true,
          contactEmail: true,
          marketingConsentBasis: true,
          marketingOptOutAt: true,
        },
      },
      lead: {
        select: {
          email: true,
          // Il Client satellite del lead è il soggetto su cui vive il consenso:
          // il Lead non ha un proprio token di disiscrizione.
          dossierClient: {
            select: {
              id: true,
              marketingConsentBasis: true,
              marketingOptOutAt: true,
            },
          },
        },
      },
    },
  });
  if (!draft) return { sent: false, note: "Bozza non trovata." };
  // Difesa anti doppio-invio: una bozza già inviata/annullata non si rispedisce.
  if (draft.status === "SENT" || draft.status === "CANCELLED") {
    return { sent: false, note: `Bozza già processata (${draft.status}).` };
  }
  // Invariante: la PRIMA mail (step 0 o bozza senza sequenza) esce SOLO su invio
  // manuale approvato. Nessun percorso automatico (cron/sequenza) può spedirla:
  // qui blocchiamo esplicitamente le chiamate auto su step non-follow-up, così
  // l'invariante regge anche a fronte di modifiche future del chiamante.
  if (opts?.auto) {
    const stepIndex = draft.sequenceStepId
      ? (await prisma.outreachSequenceStep.findUnique({
          where: { id: draft.sequenceStepId },
          select: { stepIndex: true },
        }))?.stepIndex ?? 0
      : 0;
    if (stepIndex < 1) {
      return { sent: false, note: "Prima mail: richiede invio manuale approvato." };
    }
  }

  const to = (draft.client?.contactEmail ?? draft.lead?.email ?? "").trim();
  if (!to) return { sent: false, note: "Nessuna email destinatario." };
  // Prospect da Sheet senza contatto reale: email segnaposto interna → mai inviare.
  if (/@onizuka\.local$/i.test(to) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { sent: false, to, note: "Email segnaposto/non valida — usa WhatsApp o chiamata." };
  }

  // ── Doppioni in anagrafica ───────────────────────────────────────────────
  // ~306 clienti duplicati per telefono e ~120 per email: la stessa persona
  // esiste più volte sotto ragioni sociali diverse, ognuna con la sua sequenza.
  // Il controllo è sul RECAPITO, non sul record: è la persona a ricevere le
  // mail, non la scheda.
  const cooldown = await checkRecipientCooldown(to, draft.id);
  if (cooldown.blocked) {
    return { sent: false, to, note: cooldown.reason };
  }

  // ── Consenso (GDPR) ──────────────────────────────────────────────────────
  // Il soggetto del consenso è il Client destinatario o, per un lead, il suo
  // Client satellite. Prima questo controllo non esisteva: chi si disiscriveva
  // dalle campagne continuava a ricevere l'outreach, e viceversa.
  const consentSubject = draft.client ?? draft.lead?.dossierClient ?? null;
  if (!consentSubject) {
    return { sent: false, to, note: "Nessun soggetto di consenso collegato: invio bloccato." };
  }
  if (!isEmailable(consentSubject)) {
    const why = consentSubject.marketingOptOutAt ? "si è disiscritto" : "non ha una base di contatto valida";
    return { sent: false, to, note: `Invio bloccato: il destinatario ${why}.` };
  }

  // Disiscrizione reale: il token viene creato adesso se manca, così il link nel
  // footer punta sempre a qualcosa che esiste davvero.
  const optOutToken = await ensureClientOptOutToken(consentSubject.id);
  const unsubscribeUrl = buildUnsubscribeUrl(optOutToken);

  // Pixel e riscrittura link solo con consenso esplicito: su un contatto a freddo
  // sono profilazione senza base giuridica.
  const tracking = consentSubject.marketingConsentBasis === "EXPLICIT";
  // Art. 14 GDPR: se i dati non li ha dati l'interessato, va detto da dove arrivano.
  const sourceNote = tracking ? null : DATA_SOURCE_NOTE;

  const abVariant = await resolveReachAbVariantForSend(draft.ownerUserId, undefined);
  const subject = pickOutreachSubject(draft, abVariant);
  const rawBody = pickOutreachBody(draft, abVariant);

  // ── Qualità del testo ────────────────────────────────────────────────────
  // Ultimo controllo prima che il messaggio esca: placeholder non sostituiti,
  // interpolazioni fallite, punteggi a zero, ragione sociale grezza. Difetti
  // così si scoprivano solo andandoli a cercare a mano, a mail già partita.
  const quality = validateOutreachDraft({ subject, body: rawBody });
  if (!quality.ok) {
    return { sent: false, to, note: `Invio bloccato — ${describeOutreachQuality(quality)}` };
  }

  const bodyOptions = { unsubscribeUrl, tracking, sourceNote };
  const emailBody = appendOutreachTextFooter(rawBody, bodyOptions);
  const html = wrapOutreachHtmlBody(rawBody, draft.id, bodyOptions);
  // RFC 8058: disiscrizione con un click dal client di posta, senza aprire il browser.
  // Gmail e Yahoo la richiedono per la posta massiva.
  const headers = {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  // Invio manuale dal client di posta: stesse verifiche, nessuna spedizione qui.
  // Serve a non avere una seconda strada che salta consenso, cooldown e footer.
  if (opts?.prepareOnly) {
    return {
      sent: false,
      to,
      note: "Testo verificato e pronto per l'invio manuale.",
      mailto: buildMailtoUrl({ to, subject, body: emailBody }),
      prepared: { subject, body: emailBody },
    };
  }

  if (await isGmailConnected(draft.ownerUserId)) {
    const viaApi = await sendGmailViaApi(draft.ownerUserId, {
      to,
      subject,
      text: emailBody,
      html,
      headers,
    });
    if (viaApi.ok) {
      await markOutreachDraftSent(draftId, draft.ownerUserId, { abVariantSent: abVariant, sentToEmail: to });
      return { sent: true, to, channel: "gmail", note: `Inviata via Gmail a ${to} (variante ${abVariant}).` };
    }
    return { sent: false, to, note: "Invio Gmail fallito." };
  }

  if (isSmtpConfigured()) {
    const res = await sendEmailViaSmtp({ to, subject, text: emailBody, html, headers });
    if (res.ok) {
      await markOutreachDraftSent(draftId, draft.ownerUserId, { abVariantSent: abVariant, sentToEmail: to });
      return { sent: true, to, channel: "smtp", note: `Inviata via SMTP a ${to} (variante ${abVariant}).` };
    }
    return { sent: false, to, note: `SMTP: ${res.error}` };
  }

  // Nessun canale automatico: si degrada all'invio manuale dal client di posta,
  // ma col testo GIÀ decorato (footer di disiscrizione + nota art. 14), così la
  // via manuale non è una scorciatoia per saltare le garanzie.
  return {
    sent: false,
    to,
    note: "Nessun canale email configurato: usa l'invio manuale dal tuo client di posta.",
    mailto: buildMailtoUrl({ to, subject, body: emailBody }),
    prepared: { subject, body: emailBody },
  };
}
