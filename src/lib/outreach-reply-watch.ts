import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { stopActiveOutreachSequences, captureHotReply } from "@/lib/outreach-sequence-stop";
import { ensureDigitalAuditPublicReportToken, publicReportPath } from "@/lib/public-report-token";
import { buildReplyKit } from "@/lib/reply-kit";
import { nomeCommerciale } from "@/lib/nome-commerciale";
import {
  applicaBouncePermanente,
  parseBounce,
  registraBounce,
  isMittenteDaemon,
  sembraBounce,
  type BounceParsed,
} from "@/lib/outreach-bounce";

/**
 * RILEVAMENTO DELLE RISPOSTE VIA EMAIL — il canale che mancava.
 *
 * Lo stop-on-reply copriva WhatsApp, Telegram e i cambi di stato, ma non la
 * posta: chi rispondeva alla mail (il canale primario dell'outreach) continuava
 * a ricevere i follow-up automatici. Questo watcher legge la casella via IMAP e,
 * per ogni mittente che risulta destinatario di un nostro invio o di una
 * sequenza attiva: mette in pausa le sequenze, apre il task "Rispondi a…",
 * e scrive `repliedAt` sull'ultima bozza inviata a quell'indirizzo — il numero
 * da cui nasce il tasso di risposta.
 *
 * Idempotente SENZA registro dei messaggi processati: la coppia
 * (repliedAt già valorizzato + sequenza non più ACTIVE) rende ogni run
 * successivo un no-op per lo stesso mittente. Non marca niente come letto e
 * non tocca la casella: sola lettura.
 *
 * Nello stesso giro riconosce anche i RIMBALZI (MAILER-DAEMON): un indirizzo che
 * non esiste viene registrato in `EmailBounce` e da lì in poi è fuori dal giro
 * (vedi `outreach-bounce.ts`). Costa una fetch in più solo per i messaggi che
 * hanno l'aria del bounce, non per tutta la casella.
 *
 * Credenziali: riusa quelle SMTP di Hostinger già configurate
 * (GMAIL_SMTP_USER / GMAIL_SMTP_PASSWORD), con host IMAP dedotto o esplicito
 * via OUTREACH_IMAP_HOST. Se mancano, il cron risponde "non configurato" senza
 * errori: mai bloccare il resto per una casella assente.
 */

const LOOKBACK_DAYS = 4;

type ReplyWatchResult = {
  configured: boolean;
  scanned: number;
  matchedSenders: number;
  sequencesStopped: number;
  draftsMarked: number;
  /** Notifiche di mancata consegna lette in questo giro. */
  bounces: number;
  /** Di quelle, gli indirizzi bruciati per sempre (5.x.x). */
  bouncesPermanent: number;
  note?: string;
};

/** Quante notifiche di mancata consegna si scaricano al massimo per giro. */
const MAX_BOUNCE_PER_GIRO = 25;

function imapConfig(): { host: string; user: string; pass: string } | null {
  const user = process.env.OUTREACH_IMAP_USER?.trim() || process.env.GMAIL_SMTP_USER?.trim();
  const pass = process.env.OUTREACH_IMAP_PASSWORD?.trim() || process.env.GMAIL_SMTP_PASSWORD?.trim();
  if (!user || !pass) return null;
  const host =
    process.env.OUTREACH_IMAP_HOST?.trim() ||
    // Hostinger: smtp.hostinger.com → imap.hostinger.com. Per altri provider
    // impostare OUTREACH_IMAP_HOST esplicitamente.
    (process.env.GMAIL_SMTP_HOST ?? "").replace(/^smtp\./i, "imap.") ||
    "imap.hostinger.com";
  return { host, user, pass };
}

/** Indirizzi nostri: una risposta non può essere un nostro stesso invio. */
function isOwnAddress(addr: string, selfUser: string): boolean {
  const a = addr.toLowerCase();
  return (
    a === selfUser.toLowerCase() ||
    a.endsWith("@onlinestation.it") ||
    a.endsWith("@onizuka.it") ||
    a.endsWith("@onizuka.local")
  );
}

export async function checkOutreachEmailReplies(): Promise<ReplyWatchResult> {
  const cfg = imapConfig();
  if (!cfg) {
    return {
      configured: false,
      scanned: 0,
      matchedSenders: 0,
      sequencesStopped: 0,
      draftsMarked: 0,
      bounces: 0,
      bouncesPermanent: 0,
      note: "IMAP non configurato (OUTREACH_IMAP_* o GMAIL_SMTP_*).",
    };
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: 993,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  const senders = new Map<string, { subject: string; date: Date }>();
  const bounceUids: number[] = [];
  const bounces: { parsed: BounceParsed; date: Date }[] = [];
  let scanned = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
      // ENVELOPE basta: mittente, oggetto, data. Il corpo non serve e non si scarica.
      for await (const msg of client.fetch({ since }, { envelope: true, internalDate: true, uid: true })) {
        scanned += 1;
        const from = msg.envelope?.from?.[0]?.address?.trim().toLowerCase();
        if (!from) continue;
        // I rimbalzi si riconoscono PRIMA del filtro sui nostri indirizzi: quando
        // è il nostro stesso server a rifiutare, il MAILER-DAEMON è del nostro dominio.
        if (sembraBounce(from, msg.envelope?.subject ?? "") && msg.uid) {
          bounceUids.push(msg.uid);
        }
        // Solo il sistema di posta non può essere una risposta. Un oggetto che
        // somiglia a una notifica di mancata consegna sì: quel messaggio viene
        // letto come rimbalzo E resta candidato risposta.
        if (isMittenteDaemon(from) || isOwnAddress(from, cfg.user)) continue;
        const date = msg.internalDate ? new Date(msg.internalDate) : new Date();
        const prev = senders.get(from);
        if (!prev || date > prev.date) {
          senders.set(from, { subject: msg.envelope?.subject ?? "", date });
        }
      }
      // Solo per i sospetti bounce si scarica il sorgente: il destinatario fallito
      // sta nel corpo (Final-Recipient / risposta SMTP), non nell'involucro.
      const daLeggere = bounceUids.slice(-MAX_BOUNCE_PER_GIRO);
      if (daLeggere.length) {
        for await (const msg of client.fetch(
          daLeggere.join(","),
          { source: true, internalDate: true },
          { uid: true }
        )) {
          const parsed = parseBounce(msg.source ? msg.source.toString("utf8") : "", [cfg.user]);
          if (parsed) {
            bounces.push({ parsed, date: msg.internalDate ? new Date(msg.internalDate) : new Date() });
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  let matchedSenders = 0;
  let sequencesStopped = 0;
  let draftsMarked = 0;
  let bouncesNuovi = 0;
  let bouncesPermanent = 0;

  // Rimbalzi: registrarli è ciò che impedisce di riprovare all'infinito su una
  // casella che non esiste. Un errore qui non deve far saltare le risposte.
  for (const b of bounces) {
    try {
      const nuovo = await registraBounce(b.parsed, b.date);
      if (!nuovo) continue;
      bouncesNuovi += 1;
      if (!b.parsed.permanent) continue;
      bouncesPermanent += 1;
      const esito = await applicaBouncePermanente(b.parsed.email, b.parsed);
      sequencesStopped += esito.sequencesStopped;
      draftsMarked += esito.draftsMarked;
    } catch (e) {
      console.error("[reach-replies] rimbalzo non registrato:", e instanceof Error ? e.message : e);
    }
  }

  for (const [from, info] of Array.from(senders.entries())) {
    // È uno dei nostri destinatari? Tre agganci possibili: l'invio registrato,
    // il cliente, il lead. Basta uno.
    const [sentDraft, clientHit, leadHit] = await Promise.all([
      prisma.outreachDraft.findFirst({
        where: { status: "SENT", sentToEmail: from },
        orderBy: { sentAt: "desc" },
        select: {
          id: true,
          repliedAt: true,
          clientId: true,
          leadId: true,
          ownerUserId: true,
          digitalAuditId: true,
        },
      }),
      prisma.client.findFirst({
        where: { contactEmail: { equals: from, mode: "insensitive" } },
        select: { id: true, companyName: true },
      }),
      prisma.lead.findFirst({
        where: { email: { equals: from, mode: "insensitive" } },
        select: { id: true, businessName: true, title: true, clientId: true, ownerUserId: true },
      }),
    ]);
    if (!sentDraft && !clientHit && !leadHit) continue;
    matchedSenders += 1;

    // La risposta conta una volta sola: se l'ultima bozza inviata è già marcata,
    // questo mittente è già stato processato in un run precedente.
    const alreadyHandled = sentDraft?.repliedAt != null;

    if (sentDraft && !sentDraft.repliedAt && info.date >= new Date(0)) {
      await prisma.outreachDraft.updateMany({
        where: { id: sentDraft.id, repliedAt: null },
        data: { repliedAt: info.date, statusNote: "Risposta ricevuta via email" },
      });
      draftsMarked += 1;
    }

    const clientId = sentDraft?.clientId ?? clientHit?.id ?? leadHit?.clientId ?? null;
    const leadId = sentDraft?.leadId ?? leadHit?.id ?? null;
    const stopped = await stopActiveOutreachSequences({ clientId, leadId, reason: "manual" });
    sequencesStopped += stopped.stopped;

    // Task + notifica solo la prima volta o quando abbiamo davvero fermato
    // qualcosa: niente rumore a ogni scansione della stessa risposta.
    if (!alreadyHandled || stopped.stopped > 0) {
      const ownerUserId = sentDraft?.ownerUserId ?? leadHit?.ownerUserId;
      const companyRaw =
        clientHit?.companyName ?? leadHit?.businessName ?? leadHit?.title ?? from;
      if (ownerUserId) {
        // Il report promesso in mail ha il token a scadenza (30 giorni): al
        // momento della risposta va RIGENERATO, così il link che Lorenzo gira
        // è fresco e vale da subito. Se l'audit non si trova, il kit parte
        // comunque, solo senza link.
        let reportUrl: string | null = null;
        try {
          // ⚠️ `OR: []` in Prisma matcha TUTTO: la ricerca di ripiego parte
          // solo se c'è almeno un aggancio (lead o cliente).
          const agganci = [
            ...(leadId ? [{ leadId }] : []),
            ...(clientId ? [{ clientId }] : []),
          ];
          const auditId =
            sentDraft?.digitalAuditId ??
            (agganci.length
              ? (
                  await prisma.digitalAudit.findFirst({
                    where: { OR: agganci },
                    orderBy: { createdAt: "desc" },
                    select: { id: true },
                  })
                )?.id ?? null
              : null);
          if (auditId) {
            const { token } = await ensureDigitalAuditPublicReportToken(auditId, ownerUserId);
            const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://onizuka.it";
            reportUrl = `${base}${publicReportPath(token)}`;
          }
        } catch {
          reportUrl = null;
        }

        const { nome, isPersona } = nomeCommerciale(companyRaw);
        await captureHotReply({
          ownerUserId,
          clientId,
          leadId,
          company: companyRaw,
          channel: "email",
          reportUrl,
          replyKit: buildReplyKit({ company: isPersona ? null : nome, reportUrl }),
        }).catch(() => undefined);
      }
    }
  }

  return {
    configured: true,
    scanned,
    matchedSenders,
    sequencesStopped,
    draftsMarked,
    bounces: bouncesNuovi,
    bouncesPermanent,
  };
}
