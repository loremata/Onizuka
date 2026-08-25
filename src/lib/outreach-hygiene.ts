import { prisma } from "@/lib/prisma";

/**
 * IGIENE DELL'OUTREACH — impedisce all'arretrato di formarsi.
 *
 * Il problema misurato il 28/07: 2.332 step programmati con data GIA' PASSATA
 * (il piu' vecchio del 4 giugno) e 1.147 bozze ferme in approvazione. Esisteva
 * una scadenza per gli step gia' ATTIVATI, ma nessuna per quelli SCHEDULED:
 * un passo previsto per il 4 giugno restava "dovuto" per sempre e sarebbe
 * partito tutto insieme al primo sblocco degli invii.
 *
 * Le due regole sono di TEMPESTIVITA', non di pulizia: un messaggio scritto tre
 * settimane fa su "ho guardato il tuo sito" non ha piu' senso oggi. Meglio non
 * mandarlo che mandarlo fuori tempo.
 */

/** Uno step previsto piu' di N giorni fa non e' piu' attuale: si salta. */
export const STALE_SCHEDULED_DAYS = 7;
/** Una bozza mai approvata dopo N giorni si chiude: la coda deve restare leggibile. */
export const STALE_PENDING_DRAFT_DAYS = 14;

export type OutreachHygieneResult = {
  stepsSkipped: number;
  draftsCancelled: number;
};

/**
 * Passata di manutenzione. Idempotente: girando ogni giorno tocca solo le righe
 * appena scadute. La prima esecuzione assorbe tutto l'arretrato storico.
 */
export async function sweepStaleOutreach(now = new Date()): Promise<OutreachHygieneResult> {
  const stepCutoff = new Date(now.getTime() - STALE_SCHEDULED_DAYS * 86_400_000);
  const draftCutoff = new Date(now.getTime() - STALE_PENDING_DRAFT_DAYS * 86_400_000);

  const steps = await prisma.outreachSequenceStep.updateMany({
    where: { status: "SCHEDULED", scheduledFor: { lt: stepCutoff } },
    data: { status: "SKIPPED" },
  });

  const drafts = await prisma.outreachDraft.updateMany({
    where: { status: { in: ["PENDING_APPROVAL", "DRAFT"] }, createdAt: { lt: draftCutoff } },
    // Il motivo va scritto QUI, nel momento dello scarto: prima le bozze
    // sparivano in CANCELLED senza spiegazione e la dashboard dei flussi
    // non aveva niente da raccontare (1.210 scarti muti).
    data: {
      status: "CANCELLED",
      statusNote: `Scaduta: in attesa di approvazione da oltre ${STALE_PENDING_DRAFT_DAYS} giorni`,
    },
  });

  return { stepsSkipped: steps.count, draftsCancelled: drafts.count };
}

/** Finestra entro cui lo stesso recapito non deve ricevere un secondo messaggio. */
export const RECIPIENT_COOLDOWN_DAYS = 14;

export type RecipientGuardResult = { blocked: false } | { blocked: true; reason: string };

/**
 * Blocco anti doppio invio sullo stesso RECAPITO.
 *
 * L'anagrafica contiene ~306 clienti duplicati per telefono e ~120 per email:
 * la stessa persona esiste piu' volte sotto ragioni sociali diverse, ognuna con
 * la sua sequenza. Senza questo controllo riceverebbe tre o quattro messaggi
 * nostri in parallelo — il modo piu' rapido per bruciare il dominio e la
 * reputazione. Il controllo e' sul recapito, non sul record: e' la persona a
 * riceverli, non il record.
 *
 * Deliberatamente NON guarda l'owner: se lo stesso indirizzo e' gia' stato
 * contattato, il fatto che parta da un'altra scheda non lo rende accettabile.
 */
export async function checkRecipientCooldown(
  email: string,
  currentDraftId: string,
  now = new Date()
): Promise<RecipientGuardResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { blocked: false };

  const since = new Date(now.getTime() - RECIPIENT_COOLDOWN_DAYS * 86_400_000);
  const recent = await prisma.outreachDraft.findFirst({
    where: {
      id: { not: currentDraftId },
      status: "SENT",
      sentToEmail: normalized,
      sentAt: { gte: since },
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });

  if (!recent) return { blocked: false };

  const days = Math.max(
    0,
    Math.round((now.getTime() - (recent.sentAt?.getTime() ?? now.getTime())) / 86_400_000)
  );
  return {
    blocked: true,
    reason: `Stesso recapito già contattato ${days === 0 ? "oggi" : `${days} giorni fa`}: attesa di ${RECIPIENT_COOLDOWN_DAYS} giorni (probabile doppione in anagrafica).`,
  };
}
