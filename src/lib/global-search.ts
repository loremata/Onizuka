import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { searchCatalogAssets, type CatalogAssetSearchHit } from "@/lib/catalog-asset-search";
import { buildClientSearchWhere, type ClientListFilters } from "@/lib/client-list-filters";
import { buildOwnedFlowTaskWhere, type FlowTaskListFilters } from "@/lib/flow-task-list-filters";
import { buildOwnedLeadWhere, type LeadListFilters } from "@/lib/lead-list-filters";
import { buildOwnedMemoryWhere, type MemoryListFilters } from "@/lib/memory-list-filters";
import { buildOwnedOpportunityWhere, type OpportunityListFilters } from "@/lib/opportunity-list-filters";

export type GlobalSearchResults = {
  clients: { id: string; companyName: string; contactEmail: string; status: string }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    client: { id: string; companyName: string } | null;
  }[];
  memories: {
    id: string;
    title: string;
    scope: string;
    client: { id: string; companyName: string } | null;
  }[];
  leads: {
    id: string;
    title: string;
    status: string;
    convertedClient: { id: string; companyName: string } | null;
  }[];
  opportunities: {
    id: string;
    title: string;
    status: string;
    client: { id: string; companyName: string } | null;
    lead: { id: string; businessName: string | null; title: string } | null;
    asset: { id: string; name: string } | null;
  }[];
  contacts: {
    id: string;
    name: string;
    role: string | null;
    email: string | null;
    client: { id: string; companyName: string };
  }[];
  catalogAssets: CatalogAssetSearchHit[];
  people: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    companies: { clientId: string; companyName: string }[];
  }[];
  assetSchemaGap: boolean;
};

export async function runGlobalSearch(
  ownerId: string,
  q: string,
  filters: {
    client: ClientListFilters;
    flow: FlowTaskListFilters;
    memory: MemoryListFilters;
    lead: LeadListFilters;
    opportunity: OpportunityListFilters;
  }
): Promise<{ ok: true; data: GlobalSearchResults } | { ok: false; reason: "unavailable" }> {
  const catalogAssetPromise = searchCatalogAssets(q);

  const core = await runWithDb(() =>
    Promise.all([
      prisma.client.findMany({
        where: buildClientSearchWhere(filters.client),
        take: 25,
        orderBy: { companyName: "asc" },
      }),
      prisma.flowTask.findMany({
        where: buildOwnedFlowTaskWhere(ownerId, filters.flow),
        take: 25,
        orderBy: { updatedAt: "desc" },
        include: { client: { select: { id: true, companyName: true } } },
      }),
      prisma.memoryItem.findMany({
        where: buildOwnedMemoryWhere(ownerId, filters.memory),
        take: 25,
        orderBy: { updatedAt: "desc" },
        include: { client: { select: { id: true, companyName: true } } },
      }),
      prisma.lead.findMany({
        where: buildOwnedLeadWhere(ownerId, filters.lead),
        take: 25,
        orderBy: { updatedAt: "desc" },
        include: { convertedClient: { select: { id: true, companyName: true } } },
      }),
      prisma.opportunity.findMany({
        where: buildOwnedOpportunityWhere(ownerId, filters.opportunity),
        take: 25,
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { id: true, companyName: true } },
          lead: { select: { id: true, businessName: true, title: true } },
          asset: { select: { id: true, name: true } },
        },
      }),
      prisma.clientContact.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { role: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 25,
        orderBy: [{ client: { companyName: "asc" } }, { name: "asc" }],
        include: { client: { select: { id: true, companyName: true } } },
      }),
      prisma.person.findMany({
        where: {
          ownerUserId: ownerId,
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { fiscalCode: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 25,
        orderBy: { updatedAt: "desc" },
        include: {
          clientRoles: {
            take: 5,
            include: { client: { select: { id: true, companyName: true } } },
          },
        },
      }),
    ])
  );

  if (!core.ok) return { ok: false, reason: "unavailable" };

  const catalogAssetResult = await catalogAssetPromise;
  const [clients, tasks, memories, leads, opportunities, contacts, peopleRaw] = core.data;

  const people = peopleRaw.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: p.email,
    phone: p.phone,
    companies: p.clientRoles.map((r) => ({
      clientId: r.client.id,
      companyName: r.client.companyName,
    })),
  }));

  return {
    ok: true,
    data: {
      clients,
      tasks,
      memories,
      leads,
      opportunities,
      contacts,
      people,
      catalogAssets: catalogAssetResult.items,
      assetSchemaGap: catalogAssetResult.schemaGap,
    },
  };
}
