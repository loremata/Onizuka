import { prisma } from "@/lib/prisma";

/**
 * RIMBALZI (bounce) — l'unico che sa davvero se un indirizzo esiste è il server
 * che l'ha rifiutato.
 *
 * Gli indirizzi dell'outreach arrivano dallo scraping: sono presi da siti,
 * registri e schede Google, quindi una parte è vecchia o sbagliata. Senza
 * leggere i rimbalzi si continua a scrivere a caselle che non esistono, e ogni
 * tentativo è un colpo alla reputazione del dominio — cioè alla consegna delle
 * mail che invece a destinazione ci arriverebbero.
 *
 * Il watcher IMAP riconosce i messaggi del MAILER-DAEMON, ne estrae il
 * destinatario e il codice, e registra qui il rimbalzo. Da quel momento:
 *  - la guardia in `sendOutreachDraftNow` blocca gli invii a quell'indirizzo;
 *  - l'attivazione degli step di sequenza lo salta;
 *  - la dashboard dei flussi lo mostra tra i recapiti falliti.
 *
 * Permanente (5.x.x) contro temporaneo (4.x.x): solo il permanente blocca. Una
 * casella piena o un greylisting si risolvono da soli e non vanno puniti.
 */

export type BounceParsed = {
  email: string;
  permanent: boolean;
  code: string | null;
  reason: string | null;
};

/** Mittenti che, per convenzione SMTP, portano notifiche di mancata consegna. */
const MITTENTE_DAEMON = /^(mailer-daemon|postmaster|mail-daemon|mailer_daemon)@/i;

/** Oggetti tipici delle notifiche di mancata consegna (Postfix, Exim, Exchange, Google). */
const OGGETTO_BOUNCE =
  /(undeliverable|undelivered|delivery status notification|delivery failure|delivery incomplete|failure notice|returned mail|mail delivery (failed|system)|could not be delivered|non recapitat|mancata consegna|messaggio respinto)/i;

/** Diagnosi che indicano un indirizzo che non esiste (permanente anche senza codice). */
const DIAGNOSI_PERMANENTE =
  /(user unknown|unknown user|no such user|user not found|does not exist|unrouteable address|unroutable address|address rejected|recipient rejected|mailbox unavailable|no mailbox|invalid recipient|account (?:has been )?(?:disabled|closed)|destinatario sconosciuto|casella inesistente)/i;

/** Diagnosi che indicano un problema passeggero: non bloccano l'indirizzo. */
const DIAGNOSI_TEMPORANEA =
  /(over quota|quota exceeded|mailbox full|casella piena|temporar|try again|greylist|deferred|rate limit|too many|service unavailable|connection timed out)/i;

/** Vero se un messaggio, dal solo involucro, ha l'aria di una notifica di mancata consegna. */
export function sembraBounce(from: string, subject: string): boolean {
  return MITTENTE_DAEMON.test((from ?? "").trim()) || OGGETTO_BOUNCE.test(subject ?? "");
}

/** Estrae la classe e il codice di stato ("5", "5.1.1") dal sorgente. */
function estraiStato(src: string): { classe: string | null; code: string | null } {
  const dsn = src.match(/^status:\s*([2457])\.(\d{1,3})\.(\d{1,3})/im);
  if (dsn) return { classe: dsn[1], code: `${dsn[1]}.${dsn[2]}.${dsn[3]}` };
  // Exim e i server che citano la risposta SMTP grezza: "550-5.1.1 …", "said: 550 …".
  const smtp = src.match(/\b([45])(\d\d)[ -]/);
  if (smtp) return { classe: smtp[1], code: `${smtp[1]}${smtp[2]}` };
  return { classe: null, code: null };
}

/** Prima riga utile della diagnosi, ripulita, da mostrare in dashboard. */
function estraiMotivo(src: string): string | null {
  const diag = src.match(/^diagnostic-code:\s*(.+(?:\n[ \t]+.+)*)/im);
  if (diag) return diag[1].replace(/\s+/g, " ").trim().slice(0, 300);
  const smtp = src.match(/^.*\b(?:SMTP error|said|response was)\b.*$/im);
  if (smtp) return smtp[0].replace(/\s+/g, " ").trim().slice(0, 300);
  const riga = src.match(/^.*\b[45]\d\d\b.*$/m);
  return riga ? riga[0].replace(/\s+/g, " ").trim().slice(0, 300) : null;
}

/**
 * Legge il sorgente di una notifica di mancata consegna e ne ricava il
 * destinatario fallito. `escludi` sono i nostri stessi indirizzi: il corpo di un
 * bounce riporta anche l'intestazione del messaggio originale, cioè noi.
 */
export function parseBounce(source: string, escludi: string[] = []): BounceParsed | null {
  if (!source) return null;
  const src = source.replace(/\r\n/g, "\n");
  const fuori = new Set(escludi.map((e) => e.trim().toLowerCase()).filter(Boolean));
  const scartabile = (e: string) =>
    !e ||
    fuori.has(e) ||
    MITTENTE_DAEMON.test(e) ||
    /@(?:onizuka\.local|[^@]*\.invalid)$/i.test(e) ||
    /^(?:postmaster|abuse|noreply|no-reply)@/i.test(e);

  const candidati: string[] = [];
  const push = (raw?: string | null) => {
    const e = raw?.trim().toLowerCase().replace(/^<|>$/g, "");
    if (e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !scartabile(e) && !candidati.includes(e)) {
      candidati.push(e);
    }
  };

  // 1) Il campo previsto dallo standard (RFC 3464): è quello di cui fidarsi.
  for (const m of Array.from(src.matchAll(/^(?:final|original)-recipient:\s*(?:rfc822\s*;)?\s*(.+)$/gim))) {
    push(m[1]);
  }
  // 2) Exim & co.: la risposta del server cita il RCPT TO rifiutato.
  for (const m of Array.from(src.matchAll(/rcpt to:\s*<([^>]+)>/gi))) push(m[1]);
  // 3) Ultimo ripiego: un indirizzo sulla stessa riga di un codice 4xx/5xx.
  if (candidati.length === 0) {
    for (const m of Array.from(src.matchAll(/^.*\b[45]\d\d\b.*?([\w.+-]+@[\w.-]+\.\w{2,}).*$/gim))) push(m[1]);
  }
  if (candidati.length === 0) return null;

  const { classe, code } = estraiStato(src);
  const motivo = estraiMotivo(src);
  const azioneFallita = /^action:\s*failed/im.test(src);

  let permanent: boolean;
  if (classe === "5") permanent = true;
  else if (classe === "4") permanent = false;
  else permanent = azioneFallita && Boolean(motivo && DIAGNOSI_PERMANENTE.test(motivo));

  // Una casella piena risponde 5.2.2 su alcuni server: per lo standard è un
  // rifiuto permanente, ma l'indirizzo esiste eccome. Non lo bruciamo.
  if (permanent && motivo && DIAGNOSI_TEMPORANEA.test(motivo) && !DIAGNOSI_PERMANENTE.test(motivo)) {
    permanent = false;
  }

  return { email: candidati[0], permanent, code, reason: motivo };
}

/**
 * Registra il rimbalzo. Idempotente rispetto alla finestra di scansione IMAP:
 * lo stesso messaggio riletto nei giorni successivi non gonfia il contatore
 * (si confronta la data del messaggio con l'ultima registrata).
 * Ritorna true se il rimbalzo era nuovo.
 */
export async function registraBounce(p: BounceParsed, quando: Date): Promise<boolean> {
  const email = p.email.trim().toLowerCase();
  if (!email) return false;

  const esistente = await prisma.emailBounce.findUnique({
    where: { email },
    select: { lastAt: true },
  });
  if (esistente && esistente.lastAt >= quando) return false;

  await prisma.emailBounce.upsert({
    where: { email },
    create: {
      email,
      permanent: p.permanent,
      code: p.code,
      reason: p.reason,
      firstAt: quando,
      lastAt: quando,
    },
    update: {
      // Un rimbalzo temporaneo non cancella un permanente già accertato.
      permanent: p.permanent ? true : undefined,
      code: p.code ?? undefined,
      reason: p.reason ?? undefined,
      count: { increment: 1 },
      lastAt: quando,
    },
  });
  return true;
}

/** Vero se quell'indirizzo ha già rimbalzato in modo permanente: non gli si scrive più. */
export async function isHardBounced(email?: string | null): Promise<boolean> {
  const e = email?.trim().toLowerCase();
  if (!e) return false;
  const b = await prisma.emailBounce.findUnique({ where: { email: e }, select: { permanent: true } });
  return Boolean(b?.permanent);
}

/**
 * Conseguenze di un rimbalzo permanente: si fermano le sequenze verso quel
 * recapito e si scrive il motivo sull'ultimo invio, così la dashboard dei flussi
 * lo racconta invece di lasciare un lead "contattato" che non è mai stato raggiunto.
 */
export async function applicaBouncePermanente(
  email: string,
  p: BounceParsed
): Promise<{ sequencesStopped: number; draftsMarked: number }> {
  const { stopActiveOutreachSequences } = await import("@/lib/outreach-sequence-stop");
  const indirizzo = email.trim().toLowerCase();
  const nota = `Recapito fallito${p.code ? ` (${p.code})` : ""}: l'indirizzo non riceve posta`;

  const inviata = await prisma.outreachDraft.findFirst({
    where: { status: "SENT", sentToEmail: indirizzo },
    orderBy: { sentAt: "desc" },
    select: { id: true, clientId: true, leadId: true },
  });

  let draftsMarked = 0;
  if (inviata) {
    const upd = await prisma.outreachDraft.updateMany({
      where: { id: inviata.id },
      data: { statusNote: nota },
    });
    draftsMarked = upd.count;
  }

  const [clientHit, leadHit] = await Promise.all([
    prisma.client.findFirst({
      where: { contactEmail: { equals: indirizzo, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.lead.findFirst({
      where: { email: { equals: indirizzo, mode: "insensitive" } },
      select: { id: true, clientId: true },
    }),
  ]);

  const clientId = inviata?.clientId ?? clientHit?.id ?? leadHit?.clientId ?? null;
  const leadId = inviata?.leadId ?? leadHit?.id ?? null;
  if (!clientId && !leadId) return { sequencesStopped: 0, draftsMarked };

  const stopped = await stopActiveOutreachSequences({ clientId, leadId, reason: "manual" });
  return { sequencesStopped: stopped.stopped, draftsMarked };
}
