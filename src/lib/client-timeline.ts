export type ClientTimelineEntry = {
  id: string;
  at: Date;
  kind:
    | "flow"
    | "memory"
    | "opportunity"
    | "post"
    | "asset"
    | "audit"
    | "outreach"
    | "quote"
    | "ticket";
  title: string;
  subtitle?: string;
  href: string;
};

type TimelineSource = {
  flowTasks: { id: string; title: string; status: string; updatedAt: Date }[];
  memoryItems: { id: string; title: string; scope: string; updatedAt: Date }[];
  opportunities: { id: string; title: string; status: string; updatedAt: Date }[];
  posts: { id: string; captionText: string | null; status: string; updatedAt: Date }[];
  assets: { id: string; name: string; updatedAt: Date }[];
  digitalAudits?: { id: string; businessName: string | null; overallScore: number | null; updatedAt: Date }[];
  outreachDrafts?: { id: string; subject: string; status: string; updatedAt: Date }[];
  quotes?: { id: string; title: string; status: string; updatedAt: Date; opportunityId: string }[];
  tickets?: { id: string; title: string; status: string; updatedAt: Date }[];
};

export function buildClientTimeline(
  clientId: string,
  data: TimelineSource,
  limit = 24
): ClientTimelineEntry[] {
  const entries: ClientTimelineEntry[] = [];

  for (const t of data.flowTasks) {
    entries.push({
      id: `flow-${t.id}`,
      at: t.updatedAt,
      kind: "flow",
      title: t.title,
      subtitle: `Task · ${t.status}`,
      href: `/admin/flow?clientId=${encodeURIComponent(clientId)}`,
    });
  }
  for (const m of data.memoryItems) {
    entries.push({
      id: `memory-${m.id}`,
      at: m.updatedAt,
      kind: "memory",
      title: m.title,
      subtitle: `Memoria · ${m.scope}`,
      href: `/admin/memory/${m.id}/edit`,
    });
  }
  for (const o of data.opportunities) {
    entries.push({
      id: `opp-${o.id}`,
      at: o.updatedAt,
      kind: "opportunity",
      title: o.title,
      subtitle: `Opportunità · ${o.status}`,
      href: `/admin/crm/opportunities/${o.id}/edit`,
    });
  }
  for (const p of data.posts) {
    const preview = (p.captionText ?? "").trim().slice(0, 80) || "Post senza didascalia";
    entries.push({
      id: `post-${p.id}`,
      at: p.updatedAt,
      kind: "post",
      title: preview,
      subtitle: `Contenuto · ${p.status}`,
      href: `/admin/posts/${p.id}`,
    });
  }
  for (const a of data.assets) {
    entries.push({
      id: `asset-${a.id}`,
      at: a.updatedAt,
      kind: "asset",
      title: a.name,
      subtitle: "Asset",
      href: `/admin/clients/${clientId}/assets/${a.id}/edit`,
    });
  }
  for (const a of data.digitalAudits ?? []) {
    entries.push({
      id: `audit-${a.id}`,
      at: a.updatedAt,
      kind: "audit",
      title: a.businessName ?? "Audit digitale",
      subtitle: a.overallScore != null ? `Audit · ${a.overallScore}/100` : "Audit",
      href: `/admin/audit/digital/${a.id}`,
    });
  }
  for (const d of data.outreachDrafts ?? []) {
    entries.push({
      id: `reach-${d.id}`,
      at: d.updatedAt,
      kind: "outreach",
      title: d.subject,
      subtitle: `Reach · ${d.status}`,
      href: `/admin/reach?draft=${d.id}`,
    });
  }
  for (const q of data.quotes ?? []) {
    entries.push({
      id: `quote-${q.id}`,
      at: q.updatedAt,
      kind: "quote",
      title: q.title,
      subtitle: `Preventivo · ${q.status}`,
      href: `/admin/crm/opportunities/${q.opportunityId}/quotes/${q.id}`,
    });
  }
  for (const t of data.tickets ?? []) {
    entries.push({
      id: `ticket-${t.id}`,
      at: t.updatedAt,
      kind: "ticket",
      title: t.title,
      subtitle: `Ticket · ${t.status}`,
      href: `/admin/client-portal/tickets/${t.id}`,
    });
  }

  entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  return entries.slice(0, limit);
}

export const timelineKindLabel: Record<ClientTimelineEntry["kind"], string> = {
  flow: "Flow",
  memory: "Memoria",
  opportunity: "Opportunità",
  post: "Post",
  asset: "Asset",
  audit: "Audit",
  outreach: "Reach",
  quote: "Preventivo",
  ticket: "Ticket",
};
