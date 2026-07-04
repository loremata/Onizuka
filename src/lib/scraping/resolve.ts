// Entity resolution: fonde i record registro + Places che rappresentano la
// STESSA azienda fisica in un unico ResolvedCompany. Obiettivo: zero doppioni.
//
// Due stadi di union-find:
//  1) chiavi FORTI esatte: partita IVA, google place id, telefono, dominio sito.
//  2) ponte FUZZY registro↔Places: stesso numero civico + almeno un token di via
//     condiviso + nome simile (ignorando il nome del comune, comune a tutti).
import { normName, normAddrStreet, normPhone, siteDomain, nameSim } from "./normalize";
import type { RegistroItem, PlaceItem, ResolvedCompany } from "./types";

type Node =
  | { kind: "r"; r: RegistroItem }
  | { kind: "p"; p: PlaceItem };

class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

const isActive = (s: string) => s === "attiva";

// Estrae numero civico e token di via (alfa, >3 char) escludendo il comune.
function addrParts(addr: string, comuneTokens: Set<string>): { civic: string; street: string[] } {
  const norm = normAddrStreet(addr); // già senza tipo-via e senza CAP
  const civic = (norm.match(/\b(\d{1,4})\b/) || [])[1] || "";
  const street = norm
    .split(" ")
    .filter((t) => t.length > 3 && !/\d/.test(t) && !comuneTokens.has(t));
  return { civic, street };
}

function nodeName(n: Node): string {
  return n.kind === "r" ? normName(n.r.ragioneSociale || n.r.nome) : normName(n.p.nome);
}
function nodeAddr(n: Node): string {
  return n.kind === "r" ? n.r.indirizzo : n.p.indirizzo;
}

export function resolveCompanies(
  registro: RegistroItem[],
  places: PlaceItem[],
  comuneName = ""
): ResolvedCompany[] {
  const nodes: Node[] = [
    ...registro.map((r) => ({ kind: "r", r } as Node)),
    ...places.map((p) => ({ kind: "p", p } as Node)),
  ];
  const dsu = new DSU(nodes.length);
  const comuneTokens = new Set(normName(comuneName).split(" ").filter(Boolean));

  // --- Stadio 1: chiavi forti esatte ---
  const buckets: Record<string, number[]> = {};
  const add = (key: string, i: number) => {
    if (!key) return;
    (buckets[key] ||= []).push(i);
  };
  nodes.forEach((n, i) => {
    if (n.kind === "r") {
      if (n.r.partitaIva) add(`vat:${n.r.partitaIva}`, i);
    } else {
      if (n.p.placeId) add(`pid:${n.p.placeId}`, i);
      const phone = normPhone(n.p.telefono);
      if (phone.length >= 8) add(`tel:${phone}`, i);
      const dom = siteDomain(n.p.sitoWeb);
      if (dom && !GENERIC.has(dom)) add(`dom:${dom}`, i);
    }
  });
  for (const key in buckets) {
    const list = buckets[key];
    for (let k = 1; k < list.length; k++) dsu.union(list[0], list[k]);
  }

  // --- Stadio 2: ponte fuzzy per numero civico ---
  const meta = nodes.map((n) => {
    const { civic, street } = addrParts(nodeAddr(n), comuneTokens);
    return { name: nodeName(n), civic, street: new Set(street) };
  });
  const perCivic: Record<string, number[]> = {};
  meta.forEach((m, i) => {
    if (m.civic && m.street.size) (perCivic[m.civic] ||= []).push(i);
  });
  for (const civic in perCivic) {
    const group = perCivic[civic];
    for (let a = 0; a < group.length; a++) {
      for (let b = a + 1; b < group.length; b++) {
        const i = group[a], j = group[b];
        if (dsu.find(i) === dsu.find(j)) continue;
        // almeno un token di via in comune
        let shared = false;
        for (const t of Array.from(meta[i].street)) {
          if (meta[j].street.has(t)) { shared = true; break; }
        }
        if (!shared) continue;
        if (nameSim(meta[i].name, meta[j].name) >= 0.55) dsu.union(i, j);
      }
    }
  }

  // --- Raggruppa per radice ---
  const clusters = new Map<number, number[]>();
  nodes.forEach((_, i) => {
    const root = dsu.find(i);
    const arr = clusters.get(root);
    if (arr) arr.push(i);
    else clusters.set(root, [i]);
  });

  const out: ResolvedCompany[] = [];
  for (const idxs of Array.from(clusters.values())) {
    const regs = idxs
      .filter((i) => nodes[i].kind === "r")
      .map((i) => (nodes[i] as { r: RegistroItem }).r);
    const pls = idxs
      .filter((i) => nodes[i].kind === "p")
      .map((i) => (nodes[i] as { p: PlaceItem }).p);

    const reg = regs.find((r) => isActive(r.stato)) || regs[0];
    const pl = pls
      .slice()
      .sort((a, b) => (Number(b.nRecensioni) || 0) - (Number(a.nRecensioni) || 0))[0];

    let stato: ResolvedCompany["stato"];
    let attiva: boolean;
    if (reg) {
      stato = reg.stato;
      attiva = isActive(reg.stato);
    } else {
      const chiusa = /CLOSED_PERMANENTLY/i.test(pl?.businessStatus || "");
      stato = chiusa ? "cessata" : "attiva";
      attiva = !chiusa;
    }

    const sito = pl?.sitoWeb || "";
    const fonti: string[] = [];
    if (regs.length) fonti.push("registro");
    if (pls.length) fonti.push("places");

    out.push({
      nome: reg?.ragioneSociale || pl?.nome || "",
      nomeVetrina: pl?.nome && pl.nome !== (reg?.ragioneSociale || "") ? pl.nome : "",
      partitaIva: reg?.partitaIva || "",
      stato,
      attiva,
      indirizzo: reg?.indirizzo || pl?.indirizzo || "",
      citta: reg?.citta || pl?.citta || "",
      telefono: pl?.telefono || "",
      sitoWeb: sito,
      dominioSito: siteDomain(sito),
      categoria: pl?.categoria || reg?.atecoDescrizione || "",
      ateco: reg ? [reg.atecoCodice, reg.atecoDescrizione].filter(Boolean).join(" ") : "",
      dipendenti: reg?.dipendenti || "",
      rating: pl?.rating ?? "",
      nRecensioni: pl?.nRecensioni ?? "",
      googlePlaceId: pl?.placeId || "",
      mapsUrl: pl?.mapsUrl || "",
      fonti,
    });
  }

  return out;
}

// Domini che NON identificano un'azienda: non usarli come chiave di dedup.
const GENERIC = new Set([
  "facebook.com", "instagram.com", "linktr.ee", "wordpress.com", "wixsite.com",
  "business.site", "google.com", "sites.google.com", "blogspot.com",
  "tripadvisor.it", "tripadvisor.com", "thefork.it", "justeat.it",
  "deliveroo.it", "subito.it",
]);
