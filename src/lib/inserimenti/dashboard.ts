/**
 * Aggrega il mese per il cruscotto: carica vendite e piani di tutti i brand,
 * fa girare il motore, restituisce risultati per brand + focus + totale generale.
 */

import { prisma } from "@/lib/prisma";
import { loadPlan } from "./load-plan";
import { computeMonth, focusNow, type Sale, type MonthResult, type FocusItem } from "./engine";

export interface BrandBlock {
  brand: string;
  planLabel: string;
  planStatus: string;
  engineVersion: string;
  result: MonthResult;
  focus: FocusItem[];
}

export interface DashboardData {
  month: string;
  blocks: BrandBlock[];
  grandTotal: number;
  /** Focus unificato su TIM (l'unico con gare a soglie), già ordinato. */
  focusTop: FocusItem | null;
}

const BRANDS = ["TIM", "FASTWEB", "ENEL", "ENI", "ILIAD", "KENA"] as const;

/** Mese corrente "YYYY-MM" (senza dipendere da Date nel motore). */
export function currentMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toSale(row: {
  lineKey: string;
  feeEur: unknown;
  domiciled: boolean;
  provenance: string | null;
  subtype: string | null;
}): Sale {
  return {
    lineKey: row.lineKey,
    feeEur: row.feeEur == null ? null : Number(row.feeEur),
    domiciled: row.domiciled,
    provenance: row.provenance,
    subtype: row.subtype,
  };
}

export async function loadDashboard(ownerUserId: string, month: string): Promise<DashboardData> {
  const sales = await prisma.storeSale.findMany({ where: { ownerUserId, month } });
  const inputs = await prisma.storeMonthlyInput.findMany({ where: { ownerUserId, month } });
  const inputMap: Record<string, number> = {};
  for (const i of inputs) inputMap[i.key] = Number(i.value);

  const salesByBrand = new Map<string, Sale[]>();
  for (const s of sales) {
    const arr = salesByBrand.get(s.brand) ?? [];
    arr.push(toSale(s));
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

  return { month, blocks, grandTotal: round2(grandTotal), focusTop };
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
