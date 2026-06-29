import type { ClientKind, ClientMacroCategory, ClientRelationshipState, Prisma, RetailContractKind } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;
const RETAIL_KINDS: RetailContractKind[] = ["MOBILE", "FIBER", "ENERGY", "GAS", "SKY", "TELEPASS", "OTHER"];
const REL_STATES: ClientRelationshipState[] = ["LEAD", "CLIENTE", "EX_CLIENTE"];

export type ClientListFilters = {
  q: string;
  /** Stato relazione. "active" = clienti + prospect (anagrafica unificata); "all" = tutti. */
  state: ClientRelationshipState | "all" | "active";
  kind: ClientKind | "";
  macro: ClientMacroCategory | "";
  tag: string;
  attrKey: string;
  attrValue: string;
  /** Filtri marketing retail (targeting promo). */
  operator: string;
  hasKinds: RetailContractKind[]; // contratti ATTIVI di questi tipi (AND)
  minSpend: number | null; // spesa mensile gestita minima (€)
};

export function parseClientListFilters(
  searchParams: Record<string, string | string[] | undefined>
): ClientListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const stateRaw = normalizeQueryParam(searchParams.state);
  const state: ClientRelationshipState | "all" | "active" =
    stateRaw === "all"
      ? "all"
      : stateRaw === "active"
        ? "active"
        : REL_STATES.includes(stateRaw as ClientRelationshipState)
          ? (stateRaw as ClientRelationshipState)
          : "CLIENTE";
  const kindRaw = normalizeQueryParam(searchParams.kind);
  const macroRaw = normalizeQueryParam(searchParams.macro);
  const kind = kindRaw === "PRIVATE" || kindRaw === "BUSINESS" ? kindRaw : "";
  const macro =
    macroRaw === "RETAIL_STORE" || macroRaw === "DIGITAL_AI" || macroRaw === "MIXED" ? macroRaw : "";
  const tag = normalizeQueryParam(searchParams.tag).slice(0, 60);
  const attrKey = normalizeQueryParam(searchParams.attrKey).slice(0, 60);
  const attrValue = normalizeQueryParam(searchParams.attrValue).slice(0, 120);

  const operator = normalizeQueryParam(searchParams.operator).slice(0, 60);
  const rawHas = searchParams.has;
  const hasValues = Array.isArray(rawHas) ? rawHas : rawHas ? [rawHas] : [];
  const hasKinds = hasValues.filter((v): v is RetailContractKind =>
    RETAIL_KINDS.includes(v as RetailContractKind),
  );
  const minSpendRaw = Number(normalizeQueryParam(searchParams.minSpend).replace(",", "."));
  const minSpend = Number.isFinite(minSpendRaw) && minSpendRaw > 0 ? minSpendRaw : null;

  return { q, state, kind, macro, tag, attrKey, attrValue, operator, hasKinds, minSpend };
}

/** Ricerca su campi scheda cliente + referenti collegati + tag/attributi. */
export function buildClientSearchWhere(f: ClientListFilters): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [];
  if (f.state === "active") and.push({ relationshipState: { in: ["CLIENTE", "LEAD"] } });
  else if (f.state !== "all") and.push({ relationshipState: f.state });
  if (f.kind) and.push({ kind: f.kind });
  if (f.macro) and.push({ clientMacroCategory: f.macro });
  if (f.tag) and.push({ tags: { has: f.tag } });
  // Targeting retail: operatore + presenza di contratti ATTIVI per tipo (AND).
  if (f.operator) {
    and.push({ retailContracts: { some: { status: "ACTIVE", operator: { equals: f.operator, mode: "insensitive" } } } });
  }
  for (const k of f.hasKinds) {
    and.push({ retailContracts: { some: { status: "ACTIVE", kind: k } } });
  }
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
