import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { stopActiveOutreachSequences, captureHotReply } from "@/lib/outreach-sequence-stop";

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
  note?: string;
};

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
  let scanned = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
      // ENVELOPE basta: mittente, oggetto, data. Il corpo non serve e non si scarica.
      for await (const msg of client.fetch({ since }, { envelope: true, internalDate: true })) {
        scanned += 1;
        const from = msg.envelope?.from?.[0]?.address?.trim().toLowerCase();
        if (!from || isOwnAddress(from, cfg.user)) continue;
        const date = msg.internalDate ? new Date(msg.internalDate) : new Date();
        const prev = senders.get(from);
        if (!prev || date > prev.date) {
          senders.set(from, { subject: msg.envelope?.subject ?? "", date });
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

  for (const [from, info] of Array.from(senders.entries())) {
    // È uno dei nostri destinatari? Tre agganci possibili: l'invio registrato,
    // il cliente, il lead. Basta uno.
    const [sentDraft, clientHit, leadHit] = await Promise.all([
      prisma.outreachDraft.findFirst({
        where: { status: "SENT", sentToEmail: from },
        orderBy: { sentAt: "desc" },
        select: { id: true, repliedAt: true, clientId: true, leadId: true, ownerUserId: true },
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
      const company =
        clientHit?.companyName ?? leadHit?.businessName ?? leadHit?.title ?? from;
      if (ownerUserId) {
        await captureHotReply({
          ownerUserId,
          clientId,
          leadId,
          company,
          channel: "email",
        }).catch(() => undefined);
      }
    }
  }

  return { configured: true, scanned, matchedSenders, sequencesStopped, draftsMarked };
}
