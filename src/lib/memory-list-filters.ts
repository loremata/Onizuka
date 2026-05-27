import type { MemoryScope, Prisma } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

const MEMORY_SCOPES: MemoryScope[] = [
  "PERSONAL",
  "BUSINESS",
  "ASSET",
  "CLIENT",
  "EPISODIC",
  "DOCUMENTAL",
  "SENSITIVE",
];

export const MEMORY_SCOPE_FILTER_OPTIONS = MEMORY_SCOPES;

export type MemoryListFilters = {
  q: string;
  scope: MemoryScope | null;
  clientId: string;
};

export function parseMemoryListFilters(
  searchParams: Record<string, string | string[] | undefined>
): MemoryListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const scopeRaw = normalizeQueryParam(searchParams.scope);
  const scope = MEMORY_SCOPES.includes(scopeRaw as MemoryScope) ? (scopeRaw as MemoryScope) : null;
  const clientId = normalizeQueryParam(searchParams.clientId);
  return { q, scope, clientId };
}

export function buildOwnedMemoryWhere(ownerUserId: string, f: MemoryListFilters): Prisma.MemoryItemWhereInput {
  const mode = "insensitive" as const;
  return {
    ownerUserId,
    ...(f.clientId ? { relatedClientId: f.clientId } : {}),
    ...(f.scope ? { scope: f.scope } : {}),
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode } },
            { content: { contains: f.q, mode } },
            { client: { is: { companyName: { contains: f.q, mode } } } },
            { client: { is: { slug: { contains: f.q, mode } } } },
            { tags: { has: f.q } },
          ],
        }
      : {}),
  };
}
