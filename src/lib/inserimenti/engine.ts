/**
 * Onizuka - Inserimenti — motore di calcolo compensi (funzioni PURE).
 *
 * Nessun accesso a Prisma qui dentro: input espliciti → output calcolato, così
 * il motore è testabile riga per riga contro il CRUSCOTTO Excel del negozio
 * (Ecosistema Commerciale/TIM/Monitoraggio Incentivazione Luglio 2026.xlsx),
 * che è la fonte di verità della LOGICA. I VALORI (soglie, gettoni) arrivano
 * dal piano del mese, non sono hardcodati qui.
 *
 * Due percorsi (vedi §E.0 della spec):
 *  - computeLinear : Fastweb/Enel/Eni/Iliad — qty × €/pezzo, nessuna soglia.
 *  - computeTim     : TIM — moltiplicatore sulla SOMMA DEI CANONI, bill size,
 *                     penalità incrociate, cancelli Top Club, extra/malus.
 */

// ------------------------------------------------------------------ tipi input

export type Unit = "MULTIPLIER_ON_FEE" | "EUR_PER_PIECE";

export interface Tier {
  minQty: number;
  value: number; // moltiplicatore o €/pezzo
}

export interface Line {
  key: string;
  label: string;
  /** Categoria merceologica (Mobile, Fisso, Energia…): serve ai recap, non al calcolo. */
  category?: string | null;
  unit: Unit;
  hasTiers: boolean;
  target?: number | null;
  tiers: Tier[]; // ordinati o no: il motore riordina

  // --- struttura della gara (solo MULTIPLIER_ON_FEE, dal piano) ---
  /** Il canone concorre col peso bill-size (MNP/AL) o pieno (Fisso). Default: false. */
  applyBillSize?: boolean;
  /** Come agisce la domiciliazione:
   *  - "bonus" : canone domiciliato → (mult + domiciliationValue). MNP +1,2 · AL +1,5.
   *  - "split" : canone domiciliato → mult ; non domiciliato → nonDomiciledValue. Fisso.
   *  assente   : tutti i canoni × mult. */
  domiciliationMode?: "bonus" | "split";
  domiciliationValue?: number;
  nonDomiciledValue?: number;

  // --- struttura della gara (solo EUR_PER_PIECE) ---
  /** Gettone PxQ additivo a soglia zero: compenso = (pxqEur + tierValue) × qty.
   *  Energia 10 · Telepass Family 20 · TIM Unica 0. */
  pxqEur?: number;
}

export interface Gate {
  lineKey: string;
  minQty: number;
}

export interface ScoreKpi {
  key: string;
  label: string;
  points: number;
  source: "DERIVED" | "MANUAL";
}

export interface Bonus {
  conditionLineKey: string;
  conditionMinQty: number;
  pct: number; // 0.30 = +30%
}

export interface Halving {
  inputKey: string;
  minValue: number;
  factor: number; // 0.5
}

export interface Prize {
  key: "TOP_CLUB" | "CUSTOMER_BASE";
  label: string;
  minPoints: number;
  maxPoints: number;
  minPrize: number;
  maxPrize: number;
  gates: Gate[];
  scoreKpis: ScoreKpi[];
  bonuses: Bonus[];
  halvings: Halving[];
}

/** Regole strutturali stabili, dal piano (IncentiveParam). Tutte opzionali:
 *  il motore applica solo quelle presenti. */
export interface Params {
  /** Bill size: canone >= full conta pieno, tra half e full conta metà, sotto è escluso. */
  billSize?: { full: number; half: number };
  /** Penalità AL PP: se qty AL PP < threshold, i moltiplicatori MNP scendono di delta. */
  alPpPenalty?: { threshold: number; delta: number };
  /** Extra/PxQ/malus a gettone fisso: € per ogni vendita che matcha (per lineKey o subtype). */
  extras?: Array<{ key: string; eur: number; matchLineKey?: string; matchSubtype?: string }>;
}

export interface Plan {
  brand: string;
  month: string;
  engineVersion: string; // "linear" | "tim-*"
  lines: Line[];
  prizes: Prize[];
  params: Params;
  // meta opzionali (ignorati dal calcolo, utili alla UI)
  label?: string;
  status?: string;
}

/** Una vendita, ridotta ai campi che contano per il calcolo. */
export interface Sale {
  lineKey: string;
  feeEur?: number | null;
  domiciled: boolean;
  provenance?: string | null;
  subtype?: string | null;
}

/** Input mensili non derivabili dalle vendite (KPI Customer Base, ratio, ecc). */
export type MonthlyInputs = Record<string, number>;

// ----------------------------------------------------------------- tipi output

export interface LineResult {
  key: string;
  label: string;
  category?: string | null;
  qty: number;
  /** Somma canoni idonei (solo MULTIPLIER_ON_FEE), utile per debug/parità. */
  eligibleFee: number;
  compenso: number;
  tierIndex: number;
  /** Prossima soglia in pezzi, o null se già al massimo / pista lineare. */
  nextThreshold: number | null;
  /** Pezzi mancanti alla prossima soglia. */
  missing: number;
  /** +€ sbloccabili sul mese arrivando alla prossima soglia (focus). */
  stepValue: number;
}

export interface PrizeResult {
  key: string;
  label: string;
  points: number;
  gateOpen: boolean;
  /** Il cancello messo peggio (per la UI: è quello che decide). */
  worstGate: { lineKey: string; missing: number } | null;
  base: number;
  bonus: number;
  prize: number;
}

export interface MonthResult {
  brand: string;
  lines: LineResult[];
  prizes: PrizeResult[];
  extras: number;
  total: number;
}

// --------------------------------------------------------------------- helpers

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const sortTiers = (tiers: Tier[]) => [...tiers].sort((a, b) => a.minQty - b.minQty);

/** Indice dello scaglione attivo per un dato volume (soglie ordinate). */
export function tierIndex(qty: number, tiers: Tier[]): number {
  const arr = sortTiers(tiers);
  let idx = 0;
  for (let i = 0; i < arr.length; i++) if (qty >= arr[i].minQty) idx = i;
  return idx;
}

/** Valore dello scaglione attivo (moltiplicatore o €/pezzo). */
export function tierValue(qty: number, tiers: Tier[]): number {
  const arr = sortTiers(tiers);
  if (!arr.length) return 0;
  let v = arr[0].value;
  for (const t of arr) if (qty >= t.minQty) v = t.value;
  return v;
}

/**
 * Peso di una vendita secondo il bill size (§E.1).
 * Senza regola billSize il peso è 1 (le piste EUR_PER_PIECE non la usano).
 */
export function billWeight(fee: number | null | undefined, bill?: Params["billSize"]): number {
  if (!bill) return 1;
  const f = fee ?? 0;
  if (f >= bill.full) return 1;
  if (f >= bill.half) return 0.5;
  return 0;
}

const salesFor = (sales: Sale[], lineKey: string) => sales.filter((s) => s.lineKey === lineKey);

// -------------------------------------------------------------- percorso lineare

/** Fastweb/Enel/Eni/Iliad: qty × €/pezzo. Nessuna soglia, nessun bill size. */
export function computeLinear(plan: Plan, sales: Sale[]): MonthResult {
  const lines: LineResult[] = plan.lines.map((line) => {
    const qty = salesFor(sales, line.key).length;
    const rate = line.tiers.length ? sortTiers(line.tiers)[0].value : 0;
    return {
      key: line.key,
      label: line.label,
      category: line.category ?? null,
      qty,
      eligibleFee: 0,
      compenso: round2(qty * rate),
      tierIndex: 0,
      nextThreshold: null,
      missing: 0,
      stepValue: 0,
    };
  });
  const total = round2(lines.reduce((a, l) => a + l.compenso, 0));
  return { brand: plan.brand, lines, prizes: [], extras: 0, total };
}

// ------------------------------------------------------------------ percorso TIM

/** Compenso di una singola gara TIM per un dato stato mensile. */
function computeTimLine(
  line: Line,
  sales: Sale[],
  bill: Params["billSize"],
  mnpPenalty: number,
): LineResult {
  const mine = salesFor(sales, line.key);
  const qty = mine.length;

  const idx = tierIndex(qty, line.tiers);
  const arr = sortTiers(line.tiers);
  const next = arr[idx + 1] ?? null;

  if (line.unit === "EUR_PER_PIECE") {
    // Energia/Telepass/TIM Unica: (PxQ additivo + valore scaglione) × pezzi.
    const pxq = line.pxqEur ?? 0;
    const rate = tierValue(qty, line.tiers);
    const compenso = round2((pxq + rate) * qty);
    const stepValue = next ? round2((next.value - rate) * qty) : 0;
    return {
      key: line.key,
      label: line.label,
      category: line.category ?? null,
      qty,
      eligibleFee: 0,
      compenso,
      tierIndex: idx,
      nextThreshold: next ? next.minQty : null,
      missing: next ? Math.max(0, next.minQty - qty) : 0,
      stepValue,
    };
  }

  // MULTIPLIER_ON_FEE: il moltiplicatore dello scaglione si applica alla somma
  // dei canoni. La domiciliazione e il bill size cambiano il contributo di ogni
  // canone (§E.2–E.3). La penalità AL PP è già sottratta dal chiamante.
  const mult = Math.max(0, tierValue(qty, line.tiers) - mnpPenalty);
  const domicVal = line.domiciliationValue ?? 0;
  const nonDom = line.nonDomiciledValue ?? 0;

  const perUnit = (s: Sale): number => {
    switch (line.domiciliationMode) {
      case "bonus": // MNP/AL: domiciliato prende mult + bonus, altrimenti mult
        return s.domiciled ? mult + domicVal : mult;
      case "split": // Fisso: domiciliato a scaglione, non domiciliato flat
        return s.domiciled ? mult : nonDom;
      default:
        return mult;
    }
  };

  const compensoRaw = mine.reduce((a, s) => {
    const w = line.applyBillSize ? billWeight(s.feeEur, bill) : 1;
    return a + perUnit(s) * (s.feeEur ?? 0) * w;
  }, 0);
  const eligibleFee = mine.reduce(
    (a, s) => a + (s.feeEur ?? 0) * (line.applyBillSize ? billWeight(s.feeEur, bill) : 1),
    0,
  );

  // valore dello scatto: quanto guadagno in più portando il volume alla soglia
  // successiva (l'intero mese si rivaluta al moltiplicatore più alto).
  let stepValue = 0;
  if (next) {
    const nextMult = Math.max(0, next.value - mnpPenalty);
    const nextPerUnit = (s: Sale): number =>
      line.domiciliationMode === "bonus"
        ? s.domiciled ? nextMult + domicVal : nextMult
        : line.domiciliationMode === "split"
          ? s.domiciled ? nextMult : nonDom
          : nextMult;
    const compensoNext = mine.reduce((a, s) => {
      const w = line.applyBillSize ? billWeight(s.feeEur, bill) : 1;
      return a + nextPerUnit(s) * (s.feeEur ?? 0) * w;
    }, 0);
    stepValue = round2(compensoNext - compensoRaw);
  }

  return {
    key: line.key,
    label: line.label,
    category: line.category ?? null,
    qty,
    eligibleFee: round2(eligibleFee),
    compenso: round2(compensoRaw),
    tierIndex: idx,
    nextThreshold: next ? next.minQty : null,
    missing: next ? Math.max(0, next.minQty - qty) : 0,
    stepValue,
  };
}

/** Conta i pezzi di una pista (per cancelli e punteggi). */
function qtyOf(sales: Sale[], lineKey: string): number {
  return salesFor(sales, lineKey).length;
}

/** Premio a punteggio con cancelli in AND (§E.5–E.6). */
function computePrize(
  prize: Prize,
  sales: Sale[],
  inputs: MonthlyInputs,
): PrizeResult {
  // punteggio: KPI DERIVED contati dalle vendite, MANUAL dagli input mensili
  let points = 0;
  for (const kpi of prize.scoreKpis) {
    const n = kpi.source === "DERIVED" ? qtyOf(sales, kpi.key) : (inputs[kpi.key] ?? 0);
    points += n * kpi.points;
  }

  // cancelli in AND: mancarne uno azzera. Trova il messo peggio (per la UI).
  let gateOpen = true;
  let worstGate: PrizeResult["worstGate"] = null;
  for (const gate of prize.gates) {
    const have = qtyOf(sales, gate.lineKey);
    const missing = Math.max(0, gate.minQty - have);
    if (missing > 0) {
      gateOpen = false;
      if (!worstGate || missing > worstGate.missing) worstGate = { lineKey: gate.lineKey, missing };
    }
  }

  // premio base: interpolazione lineare minPoints→maxPoints ⇒ minPrize→maxPrize
  let base = 0;
  if (gateOpen && points >= prize.minPoints) {
    if (points >= prize.maxPoints) base = prize.maxPrize;
    else {
      const frac = (points - prize.minPoints) / (prize.maxPoints - prize.minPoints);
      base = prize.minPrize + frac * (prize.maxPrize - prize.minPrize);
    }
  }

  // dimezzamenti condizionati da input mensili (Customer Base: up-selling < 8)
  for (const h of prize.halvings) {
    if ((inputs[h.inputKey] ?? 0) < h.minValue) base *= h.factor;
  }

  // bonus % condizionato dal volume di un'altra pista (Energia ≥4 → +30% Top Club)
  let bonus = 0;
  for (const b of prize.bonuses) {
    if (qtyOf(sales, b.conditionLineKey) >= b.conditionMinQty) bonus += base * b.pct;
  }

  return {
    key: prize.key,
    label: prize.label,
    points: round2(points),
    gateOpen,
    worstGate,
    base: round2(base),
    bonus: round2(bonus),
    prize: round2(base + bonus),
  };
}

/** Extra/PxQ/malus a gettone fisso (§E.4). */
function computeExtras(params: Params, sales: Sale[]): number {
  if (!params.extras) return 0;
  let sum = 0;
  for (const ex of params.extras) {
    const matches = sales.filter(
      (s) =>
        (ex.matchLineKey ? s.lineKey === ex.matchLineKey : true) &&
        (ex.matchSubtype ? s.subtype === ex.matchSubtype : true),
    ).length;
    sum += matches * ex.eur;
  }
  return round2(sum);
}

/** TIM: gare + extra + premi a punteggio. */
export function computeTim(plan: Plan, sales: Sale[], inputs: MonthlyInputs): MonthResult {
  const bill = plan.params.billSize;

  // penalità AL PP → MNP: se AL PP sotto soglia, i moltiplicatori MNP scendono.
  let mnpPenalty = 0;
  if (plan.params.alPpPenalty) {
    const alPpQty = qtyOf(sales, "AL_PP");
    if (alPpQty < plan.params.alPpPenalty.threshold) mnpPenalty = plan.params.alPpPenalty.delta;
  }

  const lines: LineResult[] = plan.lines.map((line) => {
    const penalty = line.key === "MNP" ? mnpPenalty : 0;
    return computeTimLine(line, sales, bill, penalty);
  });

  const extras = computeExtras(plan.params, sales);
  const prizes = plan.prizes.map((p) => computePrize(p, sales, inputs));

  const linesTotal = lines.reduce((a, l) => a + l.compenso, 0);
  const prizesTotal = prizes.reduce((a, p) => a + p.prize, 0);
  const total = round2(linesTotal + extras + prizesTotal);

  return { brand: plan.brand, lines, prizes, extras, total };
}

// ----------------------------------------------------------------- entrypoint

/** Instrada sul percorso giusto in base al piano. */
export function computeMonth(plan: Plan, sales: Sale[], inputs: MonthlyInputs = {}): MonthResult {
  return plan.engineVersion === "linear"
    ? computeLinear(plan, sales)
    : computeTim(plan, sales, inputs);
}

// --------------------------------------------------------------------- FOCUS ORA

export interface FocusItem {
  lineKey: string;
  label: string;
  missing: number;
  stepValue: number;
  /** €/pezzo mancante: priorità di spinta. */
  priority: number;
}

/**
 * FOCUS ORA (§E.9): la gara TIM con il miglior €/pezzo-mancante.
 * Solo piste a soglie (hasTiers): dove ogni pezzo vale uguale non c'è nulla
 * da ottimizzare. Le piste già al massimo o senza scatto sono escluse.
 *
 * NB: non tiene ancora conto dei cancelli Top Club (§H.9): un pezzo che
 * sblocca un premio da 1.300 € vale più del suo scatto di gara. Estensione
 * prevista, non ancora implementata.
 */
export function focusNow(plan: Plan, result: MonthResult): FocusItem[] {
  const tiered = new Set(plan.lines.filter((l) => l.hasTiers).map((l) => l.key));
  return result.lines
    .filter((l) => tiered.has(l.key) && l.missing > 0 && l.stepValue > 0)
    .map((l) => ({
      lineKey: l.key,
      label: l.label,
      missing: l.missing,
      stepValue: l.stepValue,
      priority: round2(l.stepValue / l.missing),
    }))
    .sort((a, b) => b.priority - a.priority);
}
