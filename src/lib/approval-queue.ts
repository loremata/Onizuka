import type { OutreachDraftStatus, QuoteStatus } from "@prisma/client";
import { hasOutreachAb } from "@/lib/outreach-ab";
import { prisma } from "@/lib/prisma";

export type ApprovalQueueItemKind = "outreach_email" | "quote" | "post";

export type ApprovalQueueItem = {
  id: string;
  kind: ApprovalQueueItemKind;
  title: string;
  subtitle: string;
  status: string;
  href: string;
  clientName: string | null;
  clientId: string | null;
  leadId: string | null;
  leadName: string | null;
  updatedAt: Date;
  /** Solo outreach_email: A/B subject o body alternativo. */
  outreachHasAb?: boolean;
  /** Solo outreach_email: corpo e varianti per anteprima/modifica inline. */
  body?: string | null;
  subjectAlt?: string | null;
  bodyAlt?: string | null;
};

const OUTREACH_PENDING: OutreachDraftStatus[] = ["DRAFT", "PENDING_APPROVAL"];
const QUOTE_PENDING: QuoteStatus[] = ["DRAFT"];

/** Coda unificata: l'AI prepara, Lorenzo approva (PUNTO-SITUA §16). */
export async function loadApprovalQueue(ownerUserId: string, limit = 50): Promise<ApprovalQueueItem[]> {
  const [drafts, quotes, posts] = await Promise.all([
    prisma.outreachDraft.findMany({
      where: { ownerUserId, status: { in: OUTREACH_PENDING } },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        client: { select: { id: true, companyName: true } },
        lead: { select: { id: true, title: true, businessName: true } },
      },
    }),
    prisma.opportunityQuote.findMany({
      where: {
        ownerUserId,
        status: { in: QUOTE_PENDING },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        opportunity: {
          select: {
            title: true,
            client: { select: { id: true, companyName: true } },
          },
        },
      },
    }),
    prisma.postItem.findMany({
      where: { status: "PENDING" },
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 20),
      select: {
        id: true,
        platform: true,
        captionText: true,
        status: true,
        updatedAt: true,
        client: { select: { id: true, companyName: true } },
      },
    }),
  ]);

  const items: ApprovalQueueItem[] = [];

  for (const d of drafts) {
    items.push({
      id: d.id,
      kind: "outreach_email",
      title: d.subject,
      subtitle: d.lead?.title ?? d.client?.companyName ?? "Outreach",
      status: d.status,
      href: `/admin/reach?draft=${d.id}`,
      clientName: d.client?.companyName ?? null,
      clientId: d.client?.id ?? null,
      leadId: d.lead?.id ?? null,
      leadName: d.lead?.businessName?.trim() || d.lead?.title || null,
      updatedAt: d.updatedAt,
      outreachHasAb: hasOutreachAb(d),
      body: d.body,
      subjectAlt: d.subjectAlt,
      bodyAlt: d.bodyAlt,
    });
  }

  for (const q of quotes) {
    items.push({
      id: q.id,
      kind: "quote",
      title: q.title || `Preventivo · ${q.opportunity.title}`,
      subtitle: q.opportunity.client?.companyName ?? q.opportunity.title,
      status: q.status,
      href: `/admin/crm/opportunities/${q.opportunityId}/quotes/${q.id}`,
      clientName: q.opportunity.client?.companyName ?? null,
      clientId: q.opportunity.client?.id ?? null,
      leadId: null,
      leadName: null,
      updatedAt: q.updatedAt,
    });
  }

  for (const p of posts) {
    const caption = p.captionText?.trim().slice(0, 60);
    items.push({
      id: p.id,
      kind: "post",
      title: caption ? `${p.platform} · ${caption}` : `Post ${p.platform}`,
      subtitle: p.client.companyName,
      status: p.status,
      href: `/admin/posts/${p.id}`,
      clientName: p.client.companyName,
      clientId: p.client.id,
      leadId: null,
      leadName: null,
      updatedAt: p.updatedAt,
    });
  }

  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit);
}

export async function countApprovalQueuePending(ownerUserId: string): Promise<number> {
  const [outreach, quotes, posts] = await Promise.all([
    prisma.outreachDraft.count({
      where: { ownerUserId, status: { in: OUTREACH_PENDING } },
    }),
    prisma.opportunityQuote.count({
      where: { ownerUserId, status: { in: QUOTE_PENDING } },
    }),
    prisma.postItem.count({ where: { status: "PENDING" } }),
  ]);
  return outreach + quotes + posts;
}
