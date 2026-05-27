import { prisma } from "@/lib/prisma";
import { getDormantClients } from "@/lib/dormant-reactivation";
import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";
import { loadFinanceLedgerStats } from "@/lib/finance-ledger-stats";

export type IntelligenceItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export async function refreshIntelligenceRecommendations(ownerUserId: string): Promise<number> {
  const candidates: Omit<IntelligenceItem, "id">[] = [];

  const [bottlenecks, dormant, ledger, outreachPending] = await Promise.all([
    getLeadPipelineBottlenecks(ownerUserId, 5),
    getDormantClients(ownerUserId, 5),
    loadFinanceLedgerStats(ownerUserId),
    prisma.outreachDraft.count({ where: { ownerUserId, status: "PENDING_APPROVAL" } }),
  ]);

  for (const b of bottlenecks.slice(0, 3)) {
    candidates.push({
      kind: "pipeline_bottleneck",
      title: `Lead in stallo: ${b.businessName ?? b.title}`,
      detail: b.reason,
      href: `/admin/crm/leads`,
      priority: b.priorityScore >= 70 ? "high" : "medium",
    });
  }

  for (const d of dormant.slice(0, 2)) {
    candidates.push({
      kind: "dormant_client",
      title: `Riattiva ${d.companyName}`,
      detail: d.reason,
      href: `/admin/clients/${d.clientId}`,
      priority: "medium",
    });
  }

  if (ledger.ok && ledger.stats.overdueCount > 0) {
    candidates.push({
      kind: "finance",
      title: "Finance scaduto",
      detail: `${ledger.stats.overdueCount} voci oltre scadenza`,
      href: "/admin/finance",
      priority: "high",
    });
  }

  if (outreachPending > 0) {
    candidates.push({
      kind: "reach",
      title: "Bozze Reach in attesa",
      detail: `${outreachPending} da approvare`,
      href: "/admin/reach",
      priority: "high",
    });
  }

  await prisma.intelligenceRecommendation.updateMany({
    where: { ownerUserId, dismissedAt: null, kind: { in: candidates.map((c) => c.kind) } },
    data: { dismissedAt: new Date() },
  });

  let created = 0;
  for (const c of candidates) {
    const exists = await prisma.intelligenceRecommendation.findFirst({
      where: {
        ownerUserId,
        kind: c.kind,
        title: c.title,
        dismissedAt: null,
        createdAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    if (exists) continue;
    await prisma.intelligenceRecommendation.create({
      data: {
        ownerUserId,
        kind: c.kind,
        title: c.title,
        detail: c.detail,
        href: c.href,
        priority: c.priority,
      },
    });
    created++;
  }

  return created;
}

export async function listIntelligenceRecommendations(
  ownerUserId: string,
  limit = 20
): Promise<IntelligenceItem[]> {
  const rows = await prisma.intelligenceRecommendation.findMany({
    where: { ownerUserId, dismissedAt: null },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    detail: r.detail ?? "",
    href: r.href ?? "/admin",
    priority: (r.priority as IntelligenceItem["priority"]) || "medium",
  }));
}
