import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { notifyAdminsViaTelegram } from "@/lib/telegram-bot";
import { bumpNotificationRev } from "@/lib/notification-rev";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function trackingSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? process.env.CRON_SECRET ?? "onizuka-dev-tracking";
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

export function wrapOutreachHtmlBody(textBody: string, draftId: string): string {
  const escaped = textBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const bodyHtml = rewriteOutreachLinksForTracking(escaped.replace(/\n/g, "<br>"), draftId);
  const pixel = buildOutreachOpenPixelUrl(draftId);
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${bodyHtml}<img src="${pixel}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" /></div>`;
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
