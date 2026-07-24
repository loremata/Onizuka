/**
 * Orchestratore server-side dell'analisi valore cliente:
 * score (computeCustomerScore) + pipeline up/cross-sell + CLV + indice priorità.
 *
 * Nota: il calcolo di wonValueEur replica quello della scheda cliente
 * (src/app/admin/clients/[id]/page.tsx): somma di estimatedValue delle
 * opportunità WON. Qui senza filtro owner (Onizuka è mono-workspace).
 */

import type { ClientKind, ClientMacroCategory, ClientStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeCustomerScore,
  type CustomerScore,
} from "@/lib/client-customer-scoring";
import {
  computeCustomerPipeline,
  RETAIL_KIND_TO_SLUG,
  type CustomerOpportunity,
} from "@/lib/customer-pipeline";
import { computeCustomerClv, type CustomerClv } from "@/lib/customer-clv";
import { SERVICE_CATEGORY_BY_SLUG, SERVICE_ECONOMICS } from "@/lib/customer-value-config";

export type CustomerValueAnalysis = {
  clientId: string;
  companyName: string;
  score: CustomerScore;
  opportunities: CustomerOpportunity[];
  /** Somma dei valori attesi della pipeline (€). */
  pipelineTotalEur: number;
  clv: CustomerClv;
  /** score × pipeline / 1000: ordina i clienti per "dove muoversi prima". */
  priorityIndex: number;
};

/** Somma estimatedValue delle opportunità WON (stessa logica della scheda cliente). */
export function sumWonValueEur(
  opportunities: Array<{ status: string; estimatedValue: { toString(): string } | null }>,
): number {
  return opportunities
    .filter((o) => o.status === "WON")
    .reduce((sum, o) => sum + (o.estimatedValue ? Number(o.estimatedValue.toString()) : 0), 0);
}

type ClientRow = {
  id: string;
  companyName: string;
  status: ClientStatus;
  kind: ClientKind | null;
  clientMacroCategory: ClientMacroCategory | null;
  vatNumber: string | null;
  updatedAt: Date;
  _count: { contacts: number };
};

type ServiceLink = { slug: string; since: Date | null };
type RetailRow = { kind: string; monthlyEur: number; signedAt: Date | null };

function analyze(
  client: ClientRow,
  activeServices: ServiceLink[],
  retailContracts: RetailRow[],
  wonValueEur: number,
  openTickets: number,
  overdueFinance: number,
  now: Date,
): CustomerValueAnalysis {
  const activeCategoryCount = new Set(
    activeServices.map((s) => SERVICE_CATEGORY_BY_SLUG[s.slug] ?? "OTHER"),
  ).size;
  const monthsSinceActivity = Math.max(
    0,
    Math.floor((now.getTime() - client.updatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)),
  );
  const isBusiness = client.kind === "BUSINESS";

  const score = computeCustomerScore({
    status: client.status,
    kind: client.kind,
    macroCategory: client.clientMacroCategory,
    hasVat: Boolean(client.vatNumber?.trim()),
    wonValueEur,
    activeRecurringCount: retailContracts.length,
    activeCategoryCount,
    monthsSinceActivity,
    overdueFinance,
    openTickets,
    contactsCount: client._count.contacts,
  });

  // Servizi posseduti = servizi catalogo attivi + contratti retail mappati a slug.
  const ownedServiceSlugs = new Set<string>(activeServices.map((s) => s.slug));
  for (const contract of retailContracts) {
    const slug = RETAIL_KIND_TO_SLUG[contract.kind];
    if (slug) ownedServiceSlugs.add(slug);
  }

  const opportunities = computeCustomerPipeline({
    ownedServiceSlugs,
    isBusiness,
    macroCategory: client.clientMacroCategory,
    score: score.score,
  });
  const pipelineTotalEur = opportunities.reduce((sum, o) => sum + o.expectedValueEur, 0);

  const clv = computeCustomerClv({
    wonValueEur,
    retailContracts,
    activeMonthlyServices: activeServices.filter(
      (s) => SERVICE_ECONOMICS[s.slug]?.recurrence === "monthly",
    ),
    pipelineExpectedTotal: pipelineTotalEur,
    now,
  });

  return {
    clientId: client.id,
    companyName: client.companyName,
    score,
    opportunities,
    pipelineTotalEur,
    clv,
    priorityIndex: Math.round((score.score * pipelineTotalEur) / 1000),
  };
}

const CLIENT_SELECT = {
  id: true,
  companyName: true,
  status: true,
  kind: true,
  clientMacroCategory: true,
  vatNumber: true,
  updatedAt: true,
  _count: { select: { contacts: true } },
} as const;

/** Analisi completa per un singolo cliente (scheda cliente, tab Commerciale). */
export async function getCustomerValueAnalysis(clientId: string): Promise<CustomerValueAnalysis | null> {
  const now = new Date();
  const [client, links, retail, wonAgg, openTickets, overdueFinance] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: CLIENT_SELECT }),
    prisma.clientCommercialService.findMany({
      where: { clientId, active: true },
      select: { since: true, commercialService: { select: { slug: true } } },
    }),
    prisma.clientRetailContract.findMany({
      where: { clientId, status: "ACTIVE" },
      select: { kind: true, monthlyEur: true, signedAt: true },
    }),
    prisma.opportunity.aggregate({
      where: { clientId, status: "WON" },
      _sum: { estimatedValue: true },
    }),
    prisma.clientTicket.count({ where: { clientId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.financeEntry.count({ where: { clientId, status: "OVERDUE" } }),
  ]);
  if (!client) return null;

  const wonValueEur = wonAgg._sum.estimatedValue ? Number(wonAgg._sum.estimatedValue.toString()) : 0;
  return analyze(
    client,
    links.map((l) => ({ slug: l.commercialService.slug, since: l.since })),
    retail.map((r) => ({ kind: r.kind, monthlyEur: Number(r.monthlyEur.toString()), signedAt: r.signedAt })),
    wonValueEur,
    openTickets,
    overdueFinance,
    now,
  );
}

/**
 * Vista aggregata: analisi per tutti i clienti attivi (status ACTIVE_CLIENT o
 * relazione CLIENTE), calcolata in memoria e ordinata per priorityIndex desc.
 */
export async function getPipelineForAllClients(limit = 15): Promise<CustomerValueAnalysis[]> {
  const now = new Date();
  const clients = await prisma.client.findMany({
    where: {
      OR: [{ status: "ACTIVE_CLIENT" }, { relationshipState: "CLIENTE" }],
    },
    select: CLIENT_SELECT,
    take: 300,
  });
  if (clients.length === 0) return [];
  const ids = clients.map((c) => c.id);

  const [links, retail, wonRows, ticketRows, financeRows] = await Promise.all([
    prisma.clientCommercialService.findMany({
      where: { clientId: { in: ids }, active: true },
      select: { clientId: true, since: true, commercialService: { select: { slug: true } } },
    }),
    prisma.clientRetailContract.findMany({
      where: { clientId: { in: ids }, status: "ACTIVE" },
      select: { clientId: true, kind: true, monthlyEur: true, signedAt: true },
    }),
    prisma.opportunity.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, status: "WON" },
      _sum: { estimatedValue: true },
    }),
    prisma.clientTicket.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
    prisma.financeEntry.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, status: "OVERDUE" },
      _count: { _all: true },
    }),
  ]);

  const linksByClient = new Map<string, ServiceLink[]>();
  for (const l of links) {
    const arr = linksByClient.get(l.clientId) ?? [];
    arr.push({ slug: l.commercialService.slug, since: l.since });
    linksByClient.set(l.clientId, arr);
  }
  const retailByClient = new Map<string, RetailRow[]>();
  for (const r of retail) {
    const arr = retailByClient.get(r.clientId) ?? [];
    arr.push({ kind: r.kind, monthlyEur: Number(r.monthlyEur.toString()), signedAt: r.signedAt });
    retailByClient.set(r.clientId, arr);
  }
  const wonByClient = new Map<string, number>(
    wonRows.map((r): [string, number] => [
      r.clientId ?? "",
      r._sum.estimatedValue ? Number(r._sum.estimatedValue.toString()) : 0,
    ]),
  );
  const ticketsByClient = new Map<string, number>(
    ticketRows.map((r): [string, number] => [r.clientId, r._count._all]),
  );
  const financeByClient = new Map<string, number>(
    financeRows.map((r): [string, number] => [r.clientId ?? "", r._count._all]),
  );

  const analyses = clients.map((c) =>
    analyze(
      c,
      linksByClient.get(c.id) ?? [],
      retailByClient.get(c.id) ?? [],
      wonByClient.get(c.id) ?? 0,
      ticketsByClient.get(c.id) ?? 0,
      financeByClient.get(c.id) ?? 0,
      now,
    ),
  );
  analyses.sort((a, b) => b.priorityIndex - a.priorityIndex || b.pipelineTotalEur - a.pipelineTotalEur);
  return analyses.slice(0, limit);
}
