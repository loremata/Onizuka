import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

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

export async function recordOutreachClick(draftId: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: { id: true, clickedAt: true },
  });
  if (!draft) return;

  await prisma.outreachDraft.update({
    where: { id: draftId },
    data: {
      clickCount: { increment: 1 },
      clickedAt: draft.clickedAt ?? new Date(),
    },
  });
}

export async function recordOutreachOpen(draftId: string): Promise<void> {
  const draft = await prisma.outreachDraft.findUnique({
    where: { id: draftId },
    select: { id: true, openedAt: true, openCount: true },
  });
  if (!draft) return;

  await prisma.outreachDraft.update({
    where: { id: draftId },
    data: {
      openCount: { increment: 1 },
      openedAt: draft.openedAt ?? new Date(),
    },
  });
}

export function outreachTrackingPixelBuffer(): Buffer {
  return PIXEL_GIF;
}
