/**
 * Spaccato del mese: da "10 mobili" a "di cui 2 ricaricabili e 8 domiciliate,
 * su queste offerte, con questi canoni".
 *
 * I compensi arrivano da attributeSales(), cioè dalle stesse formule del
 * motore: nessuna ripartizione a occhio. Su una gara a soglia due MNP con
 * canoni diversi non valgono uguale, e qui si vede.
 */

import { prisma } from "@/lib/prisma";
import { loadPlan } from "./load-plan";
import { attributeSales, computeMonth, type Sale } from "./engine";

export interface Slice {
  name: string;
  qty: number;
  compenso: number;
  /** true se questa fetta non paga il gettone (canone sotto il bill size). */
  noGettone?: boolean;
}

export interface CategoryDetail {
  category: string;
  qty: number;
  compenso: number;
  /** Quante vendite non hanno il canone: il compenso mostrato è incompleto. */
  senzaCanone: number;
  byLine: Slice[];
  byOffer: Slice[];
  byPagamento: Slice[];
  byProvenance: Slice[];
  byBrand: Slice[];
}

export interface BreakdownData {
  month: string;
  brands: Slice[];
  categories: Slice[];
  /** Dettaglio della categoria selezionata, se una è selezionata. */
  detail: CategoryDetail | null;
  filtroBrand: string | null;
  filtroCategoria: string | null;
  totale: { qty: number; compenso: number; senzaCanone: number };
}

interface Row {
  brand: string;
  lineKey: string;
  lineLabel: string;
  category: string;
  offerName: string;
  domiciled: boolean;
  provenance: string | null;
  feeEur: number | null;
  compenso: number;
  paysGettone: boolean;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function group(rows: Row[], keyOf: (r: Row) => string, noGettoneOf?: (r: Row) => boolean): Slice[] {
  const m = new Map<string, Slice>();
  for (const r of rows) {
    const k = keyOf(r);
    const s = m.get(k) ?? { name: k, qty: 0, compenso: 0, noGettone: noGettoneOf ? true : undefined };
    s.qty += 1;
    s.compenso = round2(s.compenso + r.compenso);
    if (noGettoneOf && !noGettoneOf(r)) s.noGettone = false;
    m.set(k, s);
  }
  return Array.from(m.values()).sort((a, b) => b.qty - a.qty || b.compenso - a.compenso);
}

export async function loadBreakdown(
  ownerUserId: string,
  month: string,
  filtroBrand: string | null,
  filtroCategoria: string | null,
): Promise<BreakdownData> {
  const sales = await prisma.storeSale.findMany({ where: { ownerUserId, month } });

  const offers = await prisma.storeOffer.findMany({
    where: { ownerUserId },
    select: { brand: true, code: true, name: true, compensoEur: true },
  });
  const offerByCode = new Map(offers.map((o) => [`${o.brand}|${o.code}`, o]));

  // una passata per brand: il compenso di una vendita dipende dal mese INTERO
  // del suo brand (le soglie si applicano al volume complessivo)
  const rows: Row[] = [];
  const brandsPresenti = Array.from(new Set(sales.map((s) => s.brand)));

  for (const brand of brandsPresenti) {
    const brandSales = sales.filter((s) => s.brand === brand);
    const plan = await loadPlan(ownerUserId, brand, month);
    if (!plan) continue;

    const lineMeta = new Map(plan.lines.map((l) => [l.key, l]));
    const engineSales: Sale[] = brandSales.map((s) => ({
      lineKey: s.lineKey,
      feeEur: s.feeEur == null ? null : Number(s.feeEur),
      domiciled: s.domiciled,
      provenance: s.provenance,
      subtype: s.subtype,
      unitCompenso: s.offerCode
        ? (() => {
            const o = offerByCode.get(`${brand}|${s.offerCode}`);
            return o?.compensoEur == null ? null : Number(o.compensoEur);
          })()
        : null,
    }));

    const attr = attributeSales(plan, engineSales, {});
    const byIndex = new Map(attr.map((a) => [a.index, a]));

    brandSales.forEach((s, i) => {
      const a = byIndex.get(i);
      const line = lineMeta.get(s.lineKey);
      const offer = s.offerCode ? offerByCode.get(`${brand}|${s.offerCode}`) : null;
      rows.push({
        brand,
        lineKey: s.lineKey,
        lineLabel: line?.label ?? s.lineKey,
        category: line?.category ?? "Altro",
        offerName: offer?.name ?? "— fuori listino —",
        domiciled: s.domiciled,
        provenance: s.provenance,
        feeEur: s.feeEur == null ? null : Number(s.feeEur),
        compenso: a?.compenso ?? 0,
        paysGettone: a?.paysGettone ?? true,
      });
    });
  }

  // filtri: il brand restringe le categorie, la categoria restringe il dettaglio
  const afterBrand = filtroBrand ? rows.filter((r) => r.brand === filtroBrand) : rows;
  const filtrate = filtroCategoria ? afterBrand.filter((r) => r.category === filtroCategoria) : afterBrand;

  // i brand si contano SEMPRE su tutte le righe: servono a cambiare filtro
  const brands = group(rows, (r) => r.brand);
  const categories = group(afterBrand, (r) => r.category);

  let detail: CategoryDetail | null = null;
  if (filtroCategoria) {
    const senzaCanone = filtrate.filter((r) => r.feeEur == null && needsFee(r)).length;
    detail = {
      category: filtroCategoria,
      qty: filtrate.length,
      compenso: round2(filtrate.reduce((a, r) => a + r.compenso, 0)),
      senzaCanone,
      byLine: group(filtrate, (r) => r.lineLabel),
      byOffer: group(filtrate, (r) => r.offerName),
      byPagamento: group(
        filtrate,
        (r) => (r.domiciled ? "Domiciliato / ricarica automatica" : "Ricaricabile"),
      ),
      byProvenance: group(
        filtrate.filter((r) => r.provenance),
        (r) => r.provenance ?? "—",
      ),
      byBrand: group(filtrate, (r) => r.brand),
    };
  }

  return {
    month,
    brands,
    categories,
    detail,
    filtroBrand,
    filtroCategoria,
    totale: {
      qty: filtrate.length,
      compenso: round2(filtrate.reduce((a, r) => a + r.compenso, 0)),
      senzaCanone: filtrate.filter((r) => r.feeEur == null && needsFee(r)).length,
    },
  };
}

/** Una riga "ha bisogno del canone" se sta su una gara che moltiplica. */
function needsFee(r: Row): boolean {
  return r.compenso === 0 && r.feeEur == null;
}

/** Totale del mese non filtrato, per la percentuale sul totale. */
export async function monthTotal(ownerUserId: string, month: string): Promise<number> {
  const sales = await prisma.storeSale.findMany({ where: { ownerUserId, month } });
  const brands = Array.from(new Set(sales.map((s) => s.brand)));
  let t = 0;
  for (const brand of brands) {
    const plan = await loadPlan(ownerUserId, brand, month);
    if (!plan) continue;
    t += computeMonth(
      plan,
      sales
        .filter((s) => s.brand === brand)
        .map((s) => ({
          lineKey: s.lineKey,
          feeEur: s.feeEur == null ? null : Number(s.feeEur),
          domiciled: s.domiciled,
          provenance: s.provenance,
          subtype: s.subtype,
        })),
      {},
    ).total;
  }
  return round2(t);
}
