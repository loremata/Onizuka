import type { OpportunityPriority, OpportunityStatus, Prisma } from "@prisma/client";
import { opportunityPriorityOptions, opportunityStatusOptions } from "@/lib/crm-opportunity";

const Q_MAX = 200;

export function normalizeQueryParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0]?.trim() ?? "";
  return raw?.trim() ?? "";
}

export type OpportunityListFilters = {
  clientId: string;
  assetId: string;
  /** Ricerca case-insensitive su titolo, testi, cliente e asset collegato */
  q: string;
  priority: OpportunityPriority | null;
  status: OpportunityStatus | null;
};

export function parseOpportunityListFilters(
  searchParams: Record<string, string | string[] | undefined>
): OpportunityListFilters {
  const clientId = normalizeQueryParam(searchParams.clientId);
  const assetId = normalizeQueryParam(searchParams.assetId);
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);

  const pr = normalizeQueryParam(searchParams.priority);
  const priority = opportunityPriorityOptions.includes(pr as OpportunityPriority)
    ? (pr as OpportunityPriority)
    : null;

  const st = normalizeQueryParam(searchParams.status);
  const status = opportunityStatusOptions.includes(st as OpportunityStatus) ? (st as OpportunityStatus) : null;

  return { clientId, assetId, q, priority, status };
}

export function buildOwnedOpportunityWhere(
  ownerUserId: string,
  f: OpportunityListFilters
): Prisma.OpportunityWhereInput {
  return {
    ownerUserId,
    ...(f.clientId ? { clientId: f.clientId } : {}),
    ...(f.priority ? { priority: f.priority } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.assetId ? { assetId: f.assetId } : {}),
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: "insensitive" } },
            { description: { contains: f.q, mode: "insensitive" } },
            { nextAction: { contains: f.q, mode: "insensitive" } },
            { client: { is: { companyName: { contains: f.q, mode: "insensitive" } } } },
            { client: { is: { slug: { contains: f.q, mode: "insensitive" } } } },
            {
              asset: {
                is: {
                  OR: [
                    { name: { contains: f.q, mode: "insensitive" } },
                    { slug: { contains: f.q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}
