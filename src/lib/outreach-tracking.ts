import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";
import { bumpNotificationRev } from "@/lib/notification-rev";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function trackingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.CRON_SECRET;
  if (secret) return secret;
  // In produzione un segreto prevedibile renderebbe forgiabili i token di tracking,
  // e /api/reach/track/click diventerebbe un open redirect: meglio fallire.
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXTAUTH_SECRET o CRON_SECRET sono obbligatori per il tracking outreach.");
  }
  return "onizuka-dev-tracking";
}

export function signOutreachDraftId(draftId: string): string {
  return createHmac("sha256", trackingSecret()).update(draftId).digest("base64url");
}

export function verifyOutreachDraftToken(draftId: string, token: string): boolean {
  if (!token) return false;
  const expected = signOutreachDraftId(draftId);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildOutreachOpenPixelUrl(draftId: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = signOutreachDraftId(draftId);
  return `${base}/api/reach/track/open/${draftId}/${token}`;
}

function buildClickRedirectUrl(draftId: string, targetUrl: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = signOutreachDraftId(draftId);
  return `${base}/api/reach/track/click/${draftId}/${token}?u=${encodeURIComponent(targetUrl)}`;
}

export function rewriteOutreachLinksForTracking(htmlWithBreaks: string, draftId: string): string {
  return htmlWithBreaks.replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => {
    const safe = url.replace(/&/g, "&amp;");
    return `<a href="${buildClickRedirectUrl(draftId, url)}">${safe}</a>`;
  });
}

export type OutreachBodyOptions = {
  /**
   * URL assoluto di disiscrizione. Obbligatorio su ogni email commerciale:
   * senza, il destinatario non ha modo di opporsi (art. 21 GDPR).
   */
  unsubscribeUrl?: string | null;
  /**
   * Pixel di apertura e riscrittura dei link. Profilazione a tutti gli effetti:
   * si attiva SOLO con consenso esplicito, mai su un contatto a freddo.
   */
  tracking?: boolean;
  /** Da dove arriva il contatto (art. 14 GDPR: dati non raccolti presso l'interessato). */
  sourceNote?: string | null;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Righe di chiusura comuni a versione testo e HTML. */
function footerLines(opts: OutreachBodyOptions): string[] {
  const lines: string[] = [];
  if (opts.sourceNote?.trim()) lines.push(opts.sourceNote.trim());
  if (opts.unsubscribeUrl) {
    lines.push(`Non vuoi più ricevere queste email? Disiscriviti: ${opts.unsubscribeUrl}`);
  }
  return lines;
}

/** Footer in chiaro per la parte text/plain del messaggio. */
export function appendOutreachTextFooter(textBody: string, opts: OutreachBodyOptions = {}): string {
  const lines = footerLines(opts);
  if (!lines.length) return textBody;
  return `${textBody}\n\n—\n${lines.join("\n")}`;
}

export function wrapOutreachHtmlBody(
  textBody: string,
  draftId: string,
  opts: OutreachBodyOptions = {}
): string {
  const escaped = escapeHtml(textBody);
  const withBreaks = escaped.replace(/\n/g, "<br>");
  // Senza consenso esplicito il corpo resta pulito: nessun link riscritto verso il
  // nostro redirect e nessun pixel. Erano entrambi presenti su ogni mail a freddo.
  const bodyHtml = opts.tracking
    ? rewriteOutreachLinksForTracking(withBreaks, draftId)
    : withBreaks;
  const pixel = opts.tracking
    ? `<img src="${buildOutreachOpenPixelUrl(draftId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`
    : "";

  const lines = footerLines(opts);
  const footer = lines.length
    ? `<hr style="border:0;border-top:1px solid #ddd;margin:20px 0 10px"><div style="font-size:12px;line-height:1.5;color:#666">${
        opts.sourceNote?.trim() ? `${escapeHtml(opts.sourceNote.trim())}<br>` : ""
      }${
        opts.unsubscribeUrl
          ? `Non vuoi più ricevere queste email? <a href="${opts.unsubscribeUrl}" style="color:#666">Disiscriviti</a>.`
          : ""
      }</div>`
    : "";

  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${bodyHtml}${footer}${pixel}</div>`;
}

/** Notifica "segnale di intento" (apertura/click), una sola volta per bozza. */
async function notifyOutreachIntent(draftId: string, signal: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: {
      ownerUserId: true,
      clientId: true,
      subject: true,
      client: { select: { companyName: true } },
      lead: { select: { businessName: true, title: true } },
    },
  });
  if (!draft) return;

  const company =
    draft.client?.companyName ?? draft.lead?.businessName ?? draft.lead?.title ?? "Lead";
  await prisma.userNotification
    .create({
      data: {
        userId: draft.ownerUserId,
        kind: "outreach_intent",
        title: `${signal} · ${company}`,
        body: draft.subject,
        href: draft.clientId ? `/admin/clients/${draft.clientId}` : "/admin/reach",
      },
    })
    .catch(() => undefined);
  await bumpNotificationRev([draft.ownerUserId]).catch(() => undefined);
  await notifyAdminsViaTelegram(`${signal}: ${company} — "${draft.subject}".`).catch(() => undefined);
}

export async function recordOutreachClick(draftId: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: { id: true, clickedAt: true },
  });
  if (!draft) return;

  const firstClick = !draft.clickedAt;
  await prisma.outreachDraft.update({
    where: { id: draftId },
    data: {
      clickCount: { increment: 1 },
      clickedAt: draft.clickedAt ?? new Date(),
    },
  });
  // Click = intento forte (ha aperto un link, es. il report): notifica una volta.
  if (firstClick) await notifyOutreachIntent(draftId, "🖱️ Ha cliccato un link");
}

/** Finestra entro cui un "open" è quasi certo pre-fetch di un proxy (Gmail) o dello
 * scanner/anteprima, non un'apertura umana. Le mail cold non si aprono in <2 min. */
const OPEN_PREFETCH_WINDOW_MS = 120_000;

export async function recordOutreachOpen(draftId: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: { id: true, openedAt: true, sentAt: true },
  });
  if (!draft) return;

  // Conta comunque il fetch (utile come metrica grezza).
  await prisma.outreachDraft.update({
    where: { id: draftId },
    data: { openCount: { increment: 1 } },
  });

  // Se il fetch avviene subito dopo l'invio è quasi sempre il proxy immagini che
  // pre-carica il pixel (Gmail, scanner, anteprima notifica), NON un'apertura umana:
  // non lo trattiamo come "aperta" e non notifichiamo (evita falsi "ha aperto").
  const sentMs = draft.sentAt?.getTime();
  if (sentMs != null && Date.now() - sentMs < OPEN_PREFETCH_WINDOW_MS) return;

  // Apertura plausibilmente umana: registra e notifica una sola volta.
  if (!draft.openedAt) {
    await prisma.outreachDraft.update({
      where: { id: draftId },
      data: { openedAt: new Date() },
    });
    await notifyOutreachIntent(draftId, "👀 Ha aperto la mail");
  }
}

export function outreachTrackingPixelBuffer(): Buffer {
  return PIXEL_GIF;
}
