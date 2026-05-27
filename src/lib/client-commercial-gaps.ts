import { prisma } from "@/lib/prisma";

export type ClientServiceGap = {
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  brandName: string | null;
  category: string;
};

/** Servizi del catalogo non attivi sul cliente (potenziale upsell). */
export async function loadClientServiceGaps(clientId: string): Promise<ClientServiceGap[]> {
  const [catalog, active] = await Promise.all([
    prisma.commercialService.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { ecosystemBrand: { select: { name: true } } },
    }),
    prisma.clientCommercialService.findMany({
      where: { clientId, active: true },
      select: { commercialServiceId: true },
    }),
  ]);

  const activeIds = new Set(active.map((a) => a.commercialServiceId));

  return catalog
    .filter((s) => !activeIds.has(s.id))
    .map((s) => ({
      serviceId: s.id,
      serviceName: s.name,
      serviceSlug: s.slug,
      brandName: s.ecosystemBrand?.name ?? null,
      category: s.category,
    }));
}

export type ClientUpsellRow = {
  clientId: string;
  companyName: string;
  missingCount: number;
};

const GAP_THRESHOLD = 5;
const SCAN_BATCH = 48;

/** Clienti candidati collegati all'owner; senza owner = batch agency-wide (legacy). */
async function loadUpsellCandidateClientIds(ownerUserId?: string): Promise<string[]> {
  if (ownerUserId) {
    const [fromOpp, fromAudit, fromRetail] = await Promise.all([
      prisma.opportunity.findMany({
        where: { ownerUserId, status: "OPEN", clientId: { not: null } },
        select: { clientId: true },
        distinct: ["clientId"],
        take: SCAN_BATCH,
      }),
      prisma.digitalAudit.findMany({
        where: { ownerUserId, clientId: { not: null }, status: "COMPLETED" },
        select: { clientId: true },
        distinct: ["clientId"],
        take: SCAN_BATCH,
      }),
      prisma.clientRetailContract.findMany({
        where: { ownerUserId, status: "ACTIVE" },
        select: { clientId: true },
        distinct: ["clientId"],
        take: SCAN_BATCH,
      }),
    ]);

    const ids = new Set<string>();
    for (const r of [...fromOpp, ...fromAudit, ...fromRetail]) {
      if (r.clientId) ids.add(r.clientId);
    }
    if (ids.size > 0) return Array.from(ids).slice(0, SCAN_BATCH);
  }

  const fallback = await prisma.client.findMany({
    where: { status: { in: ["ACTIVE_CLIENT", "DORMANT", "INTERESTED", "NEGOTIATION"] } },
    take: SCAN_BATCH,
    select: { id: true },
  });
  return fallback.map((c) => c.id);
}

async function scoreClientsForGaps(clientIds: string[]): Promise<ClientUpsellRow[]> {
  const scored: ClientUpsellRow[] = [];
  for (const clientId of clientIds) {
    const client = await prisma.client.findFirst({
      where: { id: clientId },
      select: { companyName: true },
    });
    if (!client) continue;
    const gaps = await loadClientServiceGaps(clientId);
    if (gaps.length >= GAP_THRESHOLD) {
      scored.push({ clientId, companyName: client.companyName, missingCount: gaps.length });
    }
  }
  return scored.sort((a, b) => b.missingCount - a.missingCount);
}

export async function loadClientsWithUpsellPotential(limit = 8): Promise<ClientUpsellRow[]> {
  const ids = await loadUpsellCandidateClientIds();
  const scored = await scoreClientsForGaps(ids);
  return scored.slice(0, limit);
}

export type CommercialGapSummary = {
  totalWithGap: number;
  top: ClientUpsellRow[];
  /** Limite scan documentato (candidati collegati all'owner). */
  scanLimit: number;
};

export async function summarizeCommercialGapsForDashboard(
  ownerUserId: string,
  topLimit = 5
): Promise<CommercialGapSummary> {
  const ids = await loadUpsellCandidateClientIds(ownerUserId);
  const scored = await scoreClientsForGaps(ids);
  return {
    totalWithGap: scored.length,
    top: scored.slice(0, topLimit),
    scanLimit: SCAN_BATCH,
  };
}

export type RecommendedServiceNotProposedRow = {
  auditId: string;
  businessName: string;
  serviceName: string;
  leadId: string | null;
  clientId: string | null;
};

/** Audit con servizio consigliato ma senza opportunity OPEN collegata all'audit. */
export async function loadRecommendedServiceNotProposed(
  ownerUserId: string,
  since: Date | null,
  limit = 6
): Promise<RecommendedServiceNotProposedRow[]> {
  const audits = await prisma.digitalAudit.findMany({
    where: {
      ownerUserId,
      status: "COMPLETED",
      recommendedServiceId: { not: null },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      businessName: true,
      leadId: true,
      clientId: true,
      recommendedService: { select: { name: true } },
    },
  });

  if (audits.length === 0) return [];

  const auditIds = audits.map((a) => a.id);
  const withOpenOpp = await prisma.opportunity.findMany({
    where: {
      ownerUserId,
      status: "OPEN",
      digitalAuditId: { in: auditIds },
    },
    select: { digitalAuditId: true },
  });
  const covered = new Set(withOpenOpp.map((o) => o.digitalAuditId).filter(Boolean));

  return audits
    .filter((a) => !covered.has(a.id) && a.recommendedService?.name)
    .slice(0, limit)
    .map((a) => ({
      auditId: a.id,
      businessName: a.businessName ?? "Audit",
      serviceName: a.recommendedService!.name,
      leadId: a.leadId,
      clientId: a.clientId,
    }));
}
