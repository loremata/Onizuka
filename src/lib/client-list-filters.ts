import type { ClientKind, ClientMacroCategory, Prisma } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

export type ClientListFilters = {
  q: string;
  kind: ClientKind | "";
  macro: ClientMacroCategory | "";
  tag: string;
  attrKey: string;
  attrValue: string;
};

export function parseClientListFilters(
  searchParams: Record<string, string | string[] | undefined>
): ClientListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const kindRaw = normalizeQueryParam(searchParams.kind);
  const macroRaw = normalizeQueryParam(searchParams.macro);
  const kind = kindRaw === "PRIVATE" || kindRaw === "BUSINESS" ? kindRaw : "";
  const macro =
    macroRaw === "RETAIL_STORE" || macroRaw === "DIGITAL_AI" || macroRaw === "MIXED" ? macroRaw : "";
  const tag = normalizeQueryParam(searchParams.tag).slice(0, 60);
  const attrKey = normalizeQueryParam(searchParams.attrKey).slice(0, 60);
  const attrValue = normalizeQueryParam(searchParams.attrValue).slice(0, 120);
  return { q, kind, macro, tag, attrKey, attrValue };
}

/** Ricerca su campi scheda cliente + referenti collegati + tag/attributi. */
export function buildClientSearchWhere(f: ClientListFilters): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [];
  if (f.kind) and.push({ kind: f.kind });
  if (f.macro) and.push({ clientMacroCategory: f.macro });
  if (f.tag) and.push({ tags: { has: f.tag } });
  if (f.attrKey) {
    and.push({
      attributes: {
        some: {
          key: { equals: f.attrKey, mode: "insensitive" },
          ...(f.attrValue ? { value: { contains: f.attrValue, mode: "insensitive" } } : {}),
        },
      },
    });
  }

  if (!f.q) return and.length ? { AND: and } : {};

  const mode = "insensitive" as const;
  const contains = f.q;
  const search: Prisma.ClientWhereInput = {
    OR: [
      { companyName: { contains, mode } },
      { slug: { contains, mode } },
      { contactEmail: { contains, mode } },
      { city: { contains, mode } },
      { vatNumber: { contains, mode } },
      { fiscalCode: { contains, mode } },
      { phone: { contains, mode } },
      { website: { contains, mode } },
      { address: { contains, mode } },
      { notes: { contains, mode } },
      {
        contacts: {
          some: {
            OR: [
              { name: { contains, mode } },
              { email: { contains, mode } },
              { phone: { contains, mode } },
              { role: { contains, mode } },
            ],
          },
        },
      },
    ],
  };
  and.push(search);
  return { AND: and };
}
