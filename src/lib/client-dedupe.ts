import { prisma } from "@/lib/prisma";

export type ClientDuplicateGroup = {
  key: string;
  reason: "vat" | "email" | "name" | "name_fuzzy";
  clients: {
    id: string;
    companyName: string;
    vatNumber: string | null;
    contactEmail: string;
    phone: string | null;
  }[];
};

export function normalizeVat(vat: string | null | undefined): string | null {
  const s = vat?.replace(/\s/g, "").toUpperCase();
  return s && s.length >= 9 ? s : null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const s = email?.trim().toLowerCase();
  return s && s.includes("@") ? s : null;
}

/** Chiave dedupe ragione sociale: minuscolo, senza punteggiatura forte, spazi collassati. */
export function normalizeCompanyDedupeKey(companyName: string | null | undefined): string | null {
  if (!companyName?.trim()) return null;
  const de = companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (de.length < 4) return null;
  const noise = new Set([
    "srl",
    "srls",
    "spa",
    "sas",
    "snc",
    "ss",
    "di",
    "e",
    "the",
    "and",
  ]);
  const tokens = de.split(" ").filter((t) => t.length > 0 && !noise.has(t));
  if (tokens.length === 0) return null;
  const key = tokens.join(" ");
  return key.length >= 4 ? key : null;
}

/** Distanza di Levenshtein (piccole stringhe, uso dedupe). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]!;
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n]!;
}

type ClientRow = ClientDuplicateGroup["clients"][0];

function findFuzzyNameGroups(
  clients: ClientRow[],
  maxDistance: 1,
  fuzzyIndexedClients: number
): ClientDuplicateGroup[] {
  const keyed = clients
    .map((c) => ({ c, key: normalizeCompanyDedupeKey(c.companyName) }))
    .filter((x): x is { c: ClientRow; key: string } => x.key !== null);

  const cap = Math.min(10000, Math.max(200, fuzzyIndexedClients));
  const slice = keyed.length > cap ? keyed.slice(0, cap) : keyed;
  const n = slice.length;
  if (n < 2) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    return parent[i] === i ? i : (parent[i] = find(parent[i]!));
  }
  function union(i: number, j: number) {
    const ri = find(i);
    const rj = find(j);
    if (ri !== rj) parent[ri] = rj;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = slice[i]!.key;
      const b = slice[j]!.key;
      if (a === b) continue;
      if (Math.abs(a.length - b.length) > maxDistance) continue;
      if (levenshtein(a, b) <= maxDistance) union(i, j);
    }
  }

  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = byRoot.get(r) ?? [];
    list.push(i);
    byRoot.set(r, list);
  }

  const groups: ClientDuplicateGroup[] = [];
  const seen = new Set<string>();

  for (const indices of Array.from(byRoot.values())) {
    if (indices.length < 2) continue;
    const members: ClientRow[] = [];
    const idSet = new Set<string>();
    for (const idx of indices) {
      const c = slice[idx]!.c;
      if (!idSet.has(c.id)) {
        idSet.add(c.id);
        members.push(c);
      }
    }
    if (members.length < 2) continue;

    const id = `fuzzy:${members
      .map((m) => m.id)
      .sort()
      .join(":")}`;
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({
      key: id,
      reason: "name_fuzzy",
      clients: members.sort((a, b) => a.companyName.localeCompare(b.companyName)),
    });
  }

  return groups;
}

export type FindClientDuplicateGroupsOptions = {
  /** Clienti con nome normalizzato indicizzati per fuzzy (default 1200; max 10000 — attenzione CPU). */
  fuzzyIndexedClients?: number;
};

/** Gruppi di clienti con stessa P.IVA, stessa email, stessa ragione sociale normalizzata o nome molto simile. */
export async function findClientDuplicateGroups(
  options?: FindClientDuplicateGroupsOptions
): Promise<ClientDuplicateGroup[]> {
  const fuzzyCap = options?.fuzzyIndexedClients ?? 1200;
  const clients = await prisma.client.findMany({
    select: { id: true, companyName: true, vatNumber: true, contactEmail: true, phone: true },
    orderBy: { companyName: "asc" },
  });

  const byVat = new Map<string, ClientDuplicateGroup["clients"]>();
  const byEmail = new Map<string, ClientDuplicateGroup["clients"]>();
  const byName = new Map<string, ClientDuplicateGroup["clients"]>();

  for (const c of clients) {
    const vat = normalizeVat(c.vatNumber);
    if (vat) {
      const list = byVat.get(vat) ?? [];
      list.push(c);
      byVat.set(vat, list);
    }
    const email = normalizeEmail(c.contactEmail);
    if (email) {
      const list = byEmail.get(email) ?? [];
      if (!list.some((x) => x.id === c.id)) list.push(c);
      byEmail.set(email, list);
    }
    const nameKey = normalizeCompanyDedupeKey(c.companyName);
    if (nameKey) {
      const list = byName.get(nameKey) ?? [];
      if (!list.some((x) => x.id === c.id)) list.push(c);
      byName.set(nameKey, list);
    }
  }

  const groups: ClientDuplicateGroup[] = [];
  const seen = new Set<string>();

  for (const [key, list] of Array.from(byVat.entries())) {
    if (list.length < 2) continue;
    const id = `vat:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({ key: id, reason: "vat", clients: list });
  }

  for (const [key, list] of Array.from(byEmail.entries())) {
    if (list.length < 2) continue;
    const id = `email:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({ key: id, reason: "email", clients: list });
  }

  for (const [key, list] of Array.from(byName.entries())) {
    if (list.length < 2) continue;
    const id = `name:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({ key: id, reason: "name", clients: list });
  }

  const fuzzy = findFuzzyNameGroups(clients, 1, fuzzyCap);
  for (const g of fuzzy) {
    if (seen.has(g.key)) continue;
    seen.add(g.key);
    groups.push(g);
  }

  return groups.sort((a, b) => b.clients.length - a.clients.length);
}
