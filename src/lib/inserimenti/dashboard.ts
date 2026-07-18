/**
 * Aggrega il mese per il cruscotto: carica vendite e piani di tutti i brand,
 * fa girare il motore, restituisce risultati per brand + focus + totale generale.
 */

import { prisma } from "@/lib/prisma";
import { loadPlan } from "./load-plan";
import { computeMonth, focusNow, type Sale, type MonthResult, type FocusItem } from "./engine";
import { buildOutlook, daysInMonth, type MonthOutlook } from "./projection";
import { GOAL_KEY } from "./constants";

export interface BrandBlock {
  brand: string;
  planLabel: string;
  planStatus: string;
  engineVersion: string;
  result: MonthResult;
  focus: FocusItem[];
}

export interface RecapRow {
  name: string;
  qty: number;
  compenso: number;
}

export interface DashboardData {
  month: string;
  blocks: BrandBlock[];
  grandTotal: number;
  /** Focus unificato su TIM (l'unico con gare a soglie), già ordinato. */
  focusTop: FocusItem | null;
  /** Proiezione a fine mese e stato dei cancelli (solo TIM). */
  outlook: MonthOutlook | null;
  /** Recap aggregati, per tutti i brand. */
  byCategory: RecapRow[];
  byBrand: RecapRow[];
  /** Totale del mese precedente, per il confronto. */
  prevTotal: number;
  prevMonth: string;
  /** Vendite di oggi (chiusura giornata); null se il mese non è quello corrente. */
  today: { date: string; qty: number; compensoApprox: number; byBrand: RecapRow[] } | null;
  /** Obiettivo personale di compensi del mese (0 = non impostato). */
  goal: number;
  /** Calendario del mese, indipendente dalla presenza di gare TIM. */
  daysInMonth: number;
  daysLeft: number;
}

const BRANDS = ["TIM", "FASTWEB", "ENEL", "ENI", "ILIAD", "KENA"] as const;

/** Mese corrente "YYYY-MM" (senza dipendere da Date nel motore). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toSale(
  row: {
    brand: string;
    lineKey: string;
    offerCode: string | null;
    feeEur: unknown;
    domiciled: boolean;
    provenance: string | null;
    subtype: string | null;
  },
  /** brand|code → compenso specifico dell'offerta, se impostato in listino. */
  offerCompenso?: Map<string, number>,
): Sale {
  return {
    lineKey: row.lineKey,
    feeEur: row.feeEur == null ? null : Number(row.feeEur),
    domiciled: row.domiciled,
    provenance: row.provenance,
    subtype: row.subtype,
    unitCompenso: row.offerCode ? (offerCompenso?.get(`${row.brand}|${row.offerCode}`) ?? null) : null,
  };
}

/**
 * Compensi specifici per offerta, dove il gettone cambia da un'offerta
 * all'altra (Fastweb). Risolti al volo e non congelati sulla vendita: così
 * quando arriva la lettera con i numeri veri, basta aggiornare il listino e
 * tutto il mese si ricalcola — che è il comportamento chiesto esplicitamente.
 */
async function loadOfferCompenso(ownerUserId: string): Promise<Map<string, number>> {
  const rows = await prisma.storeOffer.findMany({
    where: { ownerUserId, compensoEur: { not: null } },
    select: { brand: true, code: true, compensoEur: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) m.set(`${r.brand}|${r.code}`, Number(r.compensoEur));
  return m;
}

export async function loadDashboard(ownerUserId: string, month: string): Promise<DashboardData> {
  const sales = await prisma.storeSale.findMany({ where: { ownerUserId, month } });
  const inputs = await prisma.storeMonthlyInput.findMany({ where: { ownerUserId, month } });
  const inputMap: Record<string, number> = {};
  for (const i of inputs) inputMap[i.key] = Number(i.value);

  const offerCompenso = await loadOfferCompenso(ownerUserId);

  const salesByBrand = new Map<string, Sale[]>();
  for (const s of sales) {
    const arr = salesByBrand.get(s.brand) ?? [];
    arr.push(toSale(s, offerCompenso));
    salesByBrand.set(s.brand, arr);
  }

  const blocks: BrandBlock[] = [];
  for (const brand of BRANDS) {
    const brandSales = salesByBrand.get(brand) ?? [];
    if (!brandSales.length) continue; // niente vendite → niente blocco
    const plan = await loadPlan(ownerUserId, brand, month);
    if (!plan) {
      // vendite senza piano: mostra i pezzi, compensi indeterminati
      blocks.push({
        brand,
        planLabel: "— nessun piano per questo mese —",
        planStatus: "MISSING",
        engineVersion: "none",
        result: emptyResult(brand, brandSales),
        focus: [],
      });
      continue;
    }
    const result = computeMonth(plan, brandSales, inputMap);
    blocks.push({
      brand,
      planLabel: plan.label ?? plan.brand,
      planStatus: plan.status ?? "ACTIVE",
      engineVersion: plan.engineVersion,
      result,
      focus: focusNow(plan, result),
    });
  }

  const grandTotal = blocks.reduce((s, b) => s + b.result.total, 0);
  const timBlock = blocks.find((b) => b.brand === "TIM");
  const focusTop = timBlock?.focus[0] ?? null;

  // --- proiezione a fine mese (solo TIM: le piste lineari non hanno soglie) ---
  const dim = daysInMonth(month);
  const now = new Date();
  const isCurrent = month === currentMonth(now);
  // su un mese passato la proiezione è il mese intero; su quello corrente, il giorno di oggi
  const dayOfMonth = isCurrent ? now.getDate() : dim;
  let outlook: MonthOutlook | null = null;
  if (timBlock) {
    const timPlan = await loadPlan(ownerUserId, "TIM", month);
    if (timPlan) outlook = buildOutlook(timPlan, timBlock.result, dayOfMonth, dim);
  }

  // --- recap per categoria e per brand ---
  const catMap = new Map<string, RecapRow>();
  const brandMap = new Map<string, RecapRow>();
  for (const b of blocks) {
    for (const l of b.result.lines) {
      if (l.qty === 0) continue;
      const cat = l.category ?? "Altro";
      const c = catMap.get(cat) ?? { name: cat, qty: 0, compenso: 0 };
      c.qty += l.qty;
      c.compenso = round2(c.compenso + l.compenso);
      catMap.set(cat, c);
    }
    const br = brandMap.get(b.brand) ?? { name: b.brand, qty: 0, compenso: 0 };
    br.qty += b.result.lines.reduce((s, l) => s + l.qty, 0);
    br.compenso = round2(br.compenso + b.result.total);
    brandMap.set(b.brand, br);
  }
  const byCategory = Array.from(catMap.values()).sort((a, b) => b.compenso - a.compenso || b.qty - a.qty);
  const byBrand = Array.from(brandMap.values()).sort((a, b) => b.compenso - a.compenso);

  // --- mese su mese ---
  const prevMonth = shiftMonth(month, -1);
  const prevTotal = await totalOf(ownerUserId, prevMonth);

  // --- chiusura giornata (solo sul mese corrente) ---
  let today: DashboardData["today"] = null;
  if (isCurrent) {
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todaySales = sales.filter((s) => s.date.toISOString().slice(0, 10) === iso);
    if (todaySales.length) {
      const tb = new Map<string, RecapRow>();
      for (const s of todaySales) {
        const r = tb.get(s.brand) ?? { name: s.brand, qty: 0, compenso: 0 };
        r.qty += 1;
        tb.set(s.brand, r);
      }
      today = {
        date: iso,
        qty: todaySales.length,
        compensoApprox: 0,
        byBrand: Array.from(tb.values()).sort((a, b) => b.qty - a.qty),
      };
    }
  }

  return {
    month,
    blocks,
    grandTotal: round2(grandTotal),
    focusTop,
    outlook,
    byCategory,
    byBrand,
    prevTotal,
    prevMonth,
    today,
    goal: inputMap[GOAL_KEY] ?? 0,
    daysInMonth: dim,
    daysLeft: Math.max(0, dim - dayOfMonth),
  };
}

/** Totale compensi di un mese (per il confronto mese-su-mese). */
async function totalOf(ownerUserId: string, month: string): Promise<number> {
  const sales = await prisma.storeSale.findMany({ where: { ownerUserId, month } });
  if (!sales.length) return 0;
  const offerCompenso = await loadOfferCompenso(ownerUserId);
  const byBrand = new Map<string, Sale[]>();
  for (const s of sales) {
    const arr = byBrand.get(s.brand) ?? [];
    arr.push(toSale(s, offerCompenso));
    byBrand.set(s.brand, arr);
  }
  let total = 0;
  for (const [brand, brandSales] of Array.from(byBrand)) {
    const plan = await loadPlan(ownerUserId, brand, month);
    if (!plan) continue;
    total += computeMonth(plan, brandSales, {}).total;
  }
  return round2(total);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Vendite registrate ma senza piano per il mese: mostra i pezzi, compensi 0. */
function emptyResult(brand: string, sales: Sale[]): MonthResult {
  const byLine = new Map<string, number>();
  for (const s of sales) byLine.set(s.lineKey, (byLine.get(s.lineKey) ?? 0) + 1);
  return {
    brand,
    lines: Array.from(byLine).map(([key, qty]) => ({
      key,
      label: key,
      qty,
      eligibleFee: 0,
      compenso: 0,
      tierIndex: 0,
      nextThreshold: null,
      missing: 0,
      stepValue: 0,
    })),
    prizes: [],
    extras: 0,
    total: 0,
  };
}
