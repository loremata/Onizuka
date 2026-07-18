/**
 * Proiezione a fine mese e raggiungibilità dei cancelli — funzioni PURE.
 *
 * La domanda a cui rispondono: "al ritmo attuale, dove arrivo?" e soprattutto
 * "questo cancello è ancora vivo o è già perso?". È la differenza fra un
 * consuntivo e uno strumento che cambia le decisioni dei giorni che restano.
 *
 * Niente `new Date()` qui dentro: giorno e lunghezza del mese arrivano da fuori,
 * così i test sono deterministici.
 */

import type { Plan, MonthResult, LineResult } from "./engine";
import { tierIndex } from "./engine";

export interface LineProjection {
  key: string;
  label: string;
  qty: number;
  /** Pezzi stimati a fine mese al ritmo attuale. */
  projectedQty: number;
  currentTierIndex: number;
  projectedTierIndex: number;
  /** true se il ritmo attuale porta a uno scaglione più alto di quello odierno. */
  willImprove: boolean;
  /** Prossima soglia, se esiste. */
  nextThreshold: number | null;
  /** Pezzi mancanti alla prossima soglia. */
  missing: number;
  /** Quanti pezzi al giorno servono nei giorni rimasti per arrivarci. */
  perDayNeeded: number;
  /** false se la soglia è fuori portata anche facendo il massimo plausibile. */
  reachable: boolean;
}

export interface GateOutlook {
  lineKey: string;
  needed: number;
  current: number;
  missing: number;
  projectedQty: number;
  perDayNeeded: number;
  reachable: boolean;
}

export interface PrizeOutlook {
  key: string;
  label: string;
  gateOpen: boolean;
  /** Tutti i cancelli, ordinati dal più lontano (è quello che decide). */
  gates: GateOutlook[];
  /** true se ALMENO un cancello è irraggiungibile → il premio è perso. */
  lost: boolean;
}

export interface MonthOutlook {
  dayOfMonth: number;
  daysInMonth: number;
  daysLeft: number;
  lines: LineProjection[];
  prizes: PrizeOutlook[];
}

/** Giorni del mese "YYYY-MM". */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Ritmo lineare: pezzi/giorno × giorni del mese. È la stessa proiezione del
 * cruscotto Excel. Volutamente semplice: con volumi bassi qualsiasi modello
 * più raffinato darebbe una falsa precisione.
 */
export function projectQty(qty: number, dayOfMonth: number, dim: number): number {
  if (dayOfMonth <= 0) return qty;
  return Math.round((qty / dayOfMonth) * dim);
}

/**
 * Una soglia è considerata fuori portata se richiede un ritmo giornaliero
 * superiore a `maxRateMultiplier` volte quello tenuto finora (default 3×).
 * Serve a smettere di consigliare strade morte a fine mese.
 */
function isReachable(
  missing: number,
  daysLeft: number,
  qty: number,
  dayOfMonth: number,
  maxRateMultiplier = 3,
): boolean {
  if (missing <= 0) return true;
  if (daysLeft <= 0) return false;
  const currentRate = dayOfMonth > 0 ? qty / dayOfMonth : 0;
  const neededRate = missing / daysLeft;
  // se non hai ancora venduto nulla non si può dire nulla: si concede il beneficio
  if (currentRate === 0) return neededRate <= 2;
  return neededRate <= currentRate * maxRateMultiplier;
}

export function buildOutlook(
  plan: Plan,
  result: MonthResult,
  dayOfMonth: number,
  dim: number,
): MonthOutlook {
  const daysLeft = Math.max(0, dim - dayOfMonth);
  const byKey = new Map<string, LineResult>(result.lines.map((l) => [l.key, l]));

  const lines: LineProjection[] = plan.lines
    .filter((l) => l.hasTiers)
    .map((line) => {
      const r = byKey.get(line.key);
      const qty = r?.qty ?? 0;
      const projectedQty = projectQty(qty, dayOfMonth, dim);
      const currentTierIndex = tierIndex(qty, line.tiers);
      const projectedTierIndex = tierIndex(projectedQty, line.tiers);
      const nextThreshold = r?.nextThreshold ?? null;
      const missing = r?.missing ?? 0;
      return {
        key: line.key,
        label: line.label,
        qty,
        projectedQty,
        currentTierIndex,
        projectedTierIndex,
        willImprove: projectedTierIndex > currentTierIndex,
        nextThreshold,
        missing,
        perDayNeeded: daysLeft > 0 && missing > 0 ? round1(missing / daysLeft) : 0,
        reachable: nextThreshold == null ? true : isReachable(missing, daysLeft, qty, dayOfMonth),
      };
    });

  const prizes: PrizeOutlook[] = plan.prizes
    .filter((p) => p.gates.length > 0)
    .map((prize) => {
      const gates: GateOutlook[] = prize.gates.map((g) => {
        const qty = byKey.get(g.lineKey)?.qty ?? 0;
        const missing = Math.max(0, g.minQty - qty);
        const projectedQty = projectQty(qty, dayOfMonth, dim);
        return {
          lineKey: g.lineKey,
          needed: g.minQty,
          current: qty,
          missing,
          projectedQty,
          perDayNeeded: daysLeft > 0 && missing > 0 ? round1(missing / daysLeft) : 0,
          reachable: isReachable(missing, daysLeft, qty, dayOfMonth),
        };
      });
      gates.sort((a, b) => b.missing - a.missing);
      return {
        key: prize.key,
        label: prize.label,
        gateOpen: gates.every((g) => g.missing <= 0),
        gates,
        lost: gates.some((g) => !g.reachable),
      };
    });

  return { dayOfMonth, daysInMonth: dim, daysLeft, lines, prizes };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
