/**
 * Ponte DB → motore: carica un piano da Prisma e lo trasforma nella forma
 * pura che engine.ts consuma. Qui vivono le conversioni Decimal→number e la
 * lettura dei params JSON; il motore resta ignaro del database.
 */

import { prisma } from "@/lib/prisma";
import type { Plan, Line, Prize, Params } from "./engine";

/** Ricostruisce il Plan puro per (owner, brand, month). Null se non esiste. */
export async function loadPlan(
  ownerUserId: string,
  brand: string,
  month: string,
): Promise<Plan | null> {
  const plan = await prisma.incentivePlan.findUnique({
    where: { ownerUserId_brand_month: { ownerUserId, brand: brand as never, month } },
    include: {
      lines: { include: { tiers: true }, orderBy: { sortOrder: "asc" } },
      prizes: { include: { gates: true, scoreKpis: true, bonuses: true, halvings: true } },
      params: true,
    },
  });
  if (!plan) return null;

  const lines: Line[] = plan.lines.map((l) => ({
    key: l.key,
    label: l.label,
    category: l.category,
    unit: l.unit,
    hasTiers: l.hasTiers,
    target: l.target,
    tiers: l.tiers.map((t) => ({ minQty: t.minQty, value: Number(t.value) })),
    // le proprietà strutturali extra vivono nei rules/params; qui le leggiamo dai params dedicati
  }));

  // arricchisci le piste con la struttura letta dai params "lineConfig" se presente,
  // altrimenti applica i default noti per brand TIM (bill size, domiciliazione).
  const paramMap = new Map(plan.params.map((p) => [p.key, p.valueJson]));

  const params: Params = {
    billSize: paramMap.get("billSize") as Params["billSize"],
    alPpPenalty: paramMap.get("alPpPenalty") as Params["alPpPenalty"],
    extras: paramMap.get("extras") as Params["extras"],
    addons: paramMap.get("addons") as Params["addons"],
  };

  // struttura per-pista: per ora derivata da convenzioni note (vedi lineStructure).
  for (const line of lines) {
    Object.assign(line, lineStructure(plan.brand, line.key));
  }

  const prizes: Prize[] = plan.prizes.map((pr) => ({
    key: pr.key,
    label: pr.label,
    minPoints: Number(pr.minPoints),
    maxPoints: Number(pr.maxPoints),
    minPrize: Number(pr.minPrize),
    maxPrize: Number(pr.maxPrize),
    gates: pr.gates.map((g) => ({ lineKey: g.lineKey, minQty: g.minQty })),
    scoreKpis: pr.scoreKpis
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((k) => ({
        key: k.key,
        label: k.label,
        points: Number(k.points),
        source: k.source,
        // deroghe di conteggio: pista diversa dalla key, filtri subtype,
        // provenienza e canone minimo (vedi ScoreKpi nel motore)
        sourceLineKey: k.sourceLineKey,
        matchSubtype: k.matchSubtype,
        excludeSubtype: k.excludeSubtype,
        excludeSubtypeIn: k.excludeSubtypeIn,
        provenanceIn: k.provenanceIn,
        provenanceNotIn: k.provenanceNotIn,
        minFeeEur: k.minFeeEur == null ? null : Number(k.minFeeEur),
      })),
    bonuses: pr.bonuses.map((b) => ({
      conditionLineKey: b.conditionLineKey,
      conditionMinQty: b.conditionMinQty,
      pct: Number(b.pct),
    })),
    halvings: pr.halvings.map((h) => ({ inputKey: h.inputKey, minValue: Number(h.minValue), factor: Number(h.factor) })),
  }));

  return {
    brand: plan.brand,
    month: plan.month,
    engineVersion: plan.engineVersion,
    lines,
    prizes,
    params,
    label: plan.label,
    status: plan.status,
  };
}

/**
 * Struttura di calcolo per pista, per brand+key. È regola strutturale (stabile),
 * quindi vive in codice versionato con engineVersion — non nei dati mensili.
 * Copre le gare TIM note; le piste lineari non ne hanno bisogno.
 */
function lineStructure(brand: string, key: string): Partial<Line> {
  if (brand !== "TIM") return {};
  switch (key) {
    case "MNP":
      return { applyBillSize: true, domiciliationMode: "bonus", domiciliationValue: 1.2 };
    case "AL_PP":
      return { applyBillSize: true, domiciliationMode: "bonus", domiciliationValue: 1.5 };
    case "ACCESSO_FISSO":
      return { applyBillSize: false, domiciliationMode: "split", nonDomiciledValue: 1.7 };
    case "ENERGIA":
      // Gara luglio 2026: gettone "tutto compreso" a soglia (110/130 €). Niente
      // PxQ additivo né qualitativa separata: il valore è già nello scaglione.
      return { pxqEur: 0 };
    case "TELEPASS_FAMILY":
      // Luglio 2026: 25 € a pezzo dal primo (Family 20 + Assistenza Europa 5) PIÙ
      // il gettone di volume su tutti i pezzi del mese (+10 da 8 pezzi, +20 da
      // 15). Entrambe le componenti stanno negli scaglioni (25/35/45), quindi
      // niente PxQ additivo qui. Gli 8 pezzi sono anche cancello del Top Club.
      return { pxqEur: 0 };
    default:
      return {};
  }
}
