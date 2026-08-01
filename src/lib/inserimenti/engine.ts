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
  /** Pista da contare, quando è diversa da `key`. Serve dove la STESSA pista
   *  pesa su DUE righe di punteggio (Top Club: una MNP vale 2 pt "No ICP" +
   *  1,5 pt "Val") e la chiave della riga non può ripetersi. */
  sourceLineKey?: string | null;
  /** Conta SOLO le vendite con questo subtype. */
  matchSubtype?: string | null;
  /** Conta tutte le vendite TRANNE quelle con questo subtype. La riga
   *  "Accessi Consumer (netto FWA Ricaricabile)" va letta così: la lettera dice
   *  «Non saranno conteggiate le acquisizioni con offerta FWA Ricaricabile»,
   *  quindi il punto spetta agli accessi a canone. */
  excludeSubtype?: string | null;
  /** Esclude più subtype insieme: la riga "Accessi Consumer" scarta FWA
   *  ricaricabile, linee PMI e trasformazioni, che hanno righe proprie. */
  excludeSubtypeIn?: string[] | null;
  /** Conta solo queste provenienze (MNP MVNO da Iliad/Coop/Poste: 3 pt). */
  provenanceIn?: string[] | null;
  /** Esclude queste provenienze (MNP netto MVNO: 2 pt). */
  provenanceNotIn?: string[] | null;
  /** Canone minimo perché il punto spetti (MNP Valore: >= 9,99 €). */
  minFeeEur?: number | null;
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
  /** Addon a gettone fisso condizionati dal NUMERO di vendite che superano una
   *  soglia (non per-pezzo, una tantum). Es. MNP: +15€ se ≥12 con canone ≥9,99;
   *  +5€/+15€ se ≥7/≥14 da Iliad-COOP. Gli addon con lo stesso `group` sono
   *  scaglioni della stessa condizione: vale solo il € più alto raggiunto. */
  addons?: Array<{
    key: string;
    eur: number;
    matchLineKey?: string;
    minFeeEur?: number;
    provenanceIn?: string[];
    minCount: number;
    group?: string;
  }>;
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
  /** Compenso della singola offerta venduta, se diverso da quello della pista.
   *  Serve dove il gettone cambia da offerta a offerta (Fastweb). Solo per le
   *  piste EUR_PER_PIECE: sulle gare TIM il compenso lo decide la soglia. */
  unitCompenso?: number | null;
}

/** Input mensili non derivabili dalle vendite (KPI Customer Base, ratio, ecc). */
export type MonthlyInputs = Record<string, number>;

// ----------------------------------------------------------------- tipi output

export interface LineResult {
  key: string;
  label: string;
  category?: string | null;
  /** Serve alla UI per capire se un compenso a 0 dipende da canoni mancanti. */
  unit: Unit;
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

/**
 * Bill size REALE: non è una soglia sulla singola SIM, è la MEDIA dei canoni di
 * tutte le SIM della gara nel mese (chiarito da Lorenzo il 30/07/2026).
 *
 * «Ai fini dell'erogazione del gettone di gara è necessario il raggiungimento
 * della soglia Bill Size di 9€. Qualora fosse compreso tra 8€ e 8,99€ verrà
 * riconosciuto il relativo gettone al 50%.» La clausola compare identica dentro
 * la gara MNP e dentro la gara AL PP Nette: si calcola per pista, sulle SIM di
 * quella pista.
 *
 * Il peso che ne esce vale per TUTTE le SIM della gara, non solo per quelle
 * sotto soglia: 5 SIM a 7,99 in mezzo a 100 a 9,99 non perdono niente, perché
 * la media resta sopra i 9 €. Al contrario, 50 SIM a 8,99 con 10 a 7,99 fanno
 * media 8,82 e pagano tutte al 50%.
 *
 * Prima del 30/07 il motore applicava la soglia SIM per SIM: azzerava le
 * singole offerte sotto 8 € anche quando la media del mese era ampiamente sopra.
 */
export function billWeightOfLine(sales: Sale[], bill?: Params["billSize"]): number {
  if (!bill) return 1;
  const conCanone = sales.filter((s) => s.feeEur != null);
  if (!conCanone.length) return 1;
  const media = conCanone.reduce((a, s) => a + (s.feeEur ?? 0), 0) / conCanone.length;
  return billWeight(media, bill);
}

const salesFor = (sales: Sale[], lineKey: string) => sales.filter((s) => s.lineKey === lineKey);

/** Peso di una vendita sulla gara: FWA ricaricabile vale 0,5 sul Fisso (soglia
 *  e canone), tutto il resto 1. UNICA definizione — la usano motore e UI. */
export function saleWeight(lineKey: string, subtype?: string | null): number {
  // FWA ricaricabile: mezzo punto sul Fisso (soglia e canone), come da lettera.
  if (lineKey === "ACCESSO_FISSO" && subtype === "FWA_RIC") return 0.5;
  // Contenuti: conta UN PEZZO PER OGNI OTT compreso nel pacchetto venduto, su
  // soglia E gettone. Dal documento del 30/07: «TIMVision S ha il pacchetto
  // base + Netflix, quindi vale 1 punto. TIMVision M ha base + Netflix e
  // Disney+, quindi 2. TIMVision L ha base + Netflix, Disney+ e Prime Video,
  // quindi 3.» Il pacchetto base non conta di per sé; esistono anche pacchetti
  // con DAZN fra gli OTT. Nessun OTT è escluso dal gettone.
  if (lineKey === "CONTENUTI") {
    if (subtype === "TIMVISION_L" || subtype === "DAZN10") return 3;
    if (subtype === "TIMVISION_M" || subtype === "MYCLUB") return 2;
    return 1;
  }
  return 1;
}

/** @deprecated Nome storico: usa `saleWeight`, che copre anche TIMVision L. */
export const fwaWeight = saleWeight;

/**
 * DEFINIZIONE UNICA di "quanti pezzi ho su questa pista" per la GARA.
 *
 * È la somma dei pesi (`saleWeight`), non il numero di righe registrate: è così
 * che TIM comunica l'avanzamento (il Fisso lo dichiara come 6,5, cioè pesato) ed
 * è il numero che finisce in `LineResult.qty`, nei cancelli dei premi, nella
 * proiezione (`buildOutlook`), in `prizeOpportunities` e nelle card della UI.
 *
 * Perché esiste: i cancelli usavano il conteggio GREZZO mentre tutto il resto
 * usava il pesato. Con 10 fibra + 6 FWA ricaricabili la card diceva "13/16,
 * mancano 3" e il motore apriva lo stesso il cancello, incassando 1.000-3.000 €
 * di Top Club mai maturati. Da qui in avanti il conteggio di gara è UNO SOLO:
 * questa funzione. Chi ha bisogno del conteggio grezzo usa `qtyOf` e spiega
 * perché (punteggi, extra e addon: lì si contano le pratiche, non i pesi).
 */
export function weightedQtyOf(sales: Sale[], lineKey: string): number {
  return round2(salesFor(sales, lineKey).reduce((a, s) => a + saleWeight(lineKey, s.subtype), 0));
}

/**
 * Numero di soglia come nella lettera di gara. Due numerazioni convivono:
 *  - gare con base pagata (MNP/AL/Valore: il tier 0 ha già un valore) → il
 *    tier 0 È la "Soglia 1", quindi soglia = indice + 1;
 *  - gare che sotto la prima soglia non pagano (Fisso/Contenuti/…: tier 0
 *    vale 0) → il tier 1 è la "Soglia 1", quindi soglia = indice.
 * Ritorna null se l'indice cade sotto la prima soglia.
 */
export function sogliaNumber(tiers: Tier[], tierIdx: number): number | null {
  const arr = sortTiers(tiers);
  if (!arr.length) return null;
  const n = arr[0].value === 0 ? tierIdx : tierIdx + 1;
  return n >= 1 ? n : null;
}

// -------------------------------------------------------------- percorso lineare

/** Fastweb/Enel/Eni/Iliad: qty × €/pezzo. Nessuna soglia, nessun bill size. */
export function computeLinear(plan: Plan, sales: Sale[]): MonthResult {
  const lines: LineResult[] = plan.lines.map((line) => {
    const mine = salesFor(sales, line.key);
    const qty = mine.length;
    const rate = line.tiers.length ? sortTiers(line.tiers)[0].value : 0;

    let compenso = 0;
    let eligibleFee = 0;

    if (line.unit === "MULTIPLIER_ON_FEE") {
      // Fastweb business (5 × canone) e Iliad (1 × canone = la spesa mensile).
      // Nessun bill size e nessuna soglia: qui il moltiplicatore è fisso.
      eligibleFee = mine.reduce((a, s) => a + (s.feeEur ?? 0), 0);
      compenso = rate * eligibleFee;
    } else {
      // € per pezzo. Il compenso può cambiare da offerta a offerta: se la
      // vendita porta il suo, vince su quello della pista.
      compenso = mine.reduce((a, s) => a + (s.unitCompenso ?? rate), 0);
    }

    return {
      key: line.key,
      label: line.label,
      category: line.category ?? null,
      unit: line.unit,
      qty,
      eligibleFee: round2(eligibleFee),
      compenso: round2(compenso),
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
  // FWA ricaricabile: pesa 0,5 sulla gara Fisso (soglia e canone), come da lettera.
  const fwWeight = (s: Sale) => saleWeight(line.key, s.subtype);
  // conteggio di gara: la definizione unica (vedi weightedQtyOf).
  const qty = weightedQtyOf(sales, line.key);

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
      unit: line.unit,
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

  // Un solo peso per tutta la pista, dalla MEDIA dei canoni del mese: il bill
  // size non guarda la singola SIM (vedi billWeightOfLine).
  const bw = line.applyBillSize ? billWeightOfLine(mine, bill) : 1;
  const compensoRaw = mine.reduce((a, s) => a + perUnit(s) * (s.feeEur ?? 0) * bw * fwWeight(s), 0);
  const eligibleFee = mine.reduce((a, s) => a + (s.feeEur ?? 0) * bw * fwWeight(s), 0);

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
    const compensoNext = mine.reduce((a, s) => a + nextPerUnit(s) * (s.feeEur ?? 0) * bw * fwWeight(s), 0);
    stepValue = round2(compensoNext - compensoRaw);
  }

  return {
    key: line.key,
    label: line.label,
    category: line.category ?? null,
    unit: line.unit,
    qty,
    eligibleFee: round2(eligibleFee),
    compenso: round2(compensoRaw),
    tierIndex: idx,
    nextThreshold: next ? next.minQty : null,
    missing: next ? Math.max(0, next.minQty - qty) : 0,
    stepValue,
  };
}

/**
 * Conteggio GREZZO: quante pratiche ho registrato su questa pista, senza pesi.
 *
 * NON è il conteggio di gara (quello è `weightedQtyOf`). Serve solo dove la
 * lettera conta le PRATICHE e non i pezzi-gara:
 *  - punteggi Top Club/Customer Base (una FWA ricaricabile porta i suoi 4 punti
 *    interi, non 2: il peso 0,5 vale sulla soglia della gara Fisso, non sul
 *    punteggio) — vedi `qtyOfKpi`;
 *  - extra/PxQ/malus e addon a conteggio (`computeExtras`, `computeAddons`).
 * Ogni chiamante spiega sul posto perché lì il grezzo è quello giusto.
 */
function qtyOf(sales: Sale[], lineKey: string): number {
  return salesFor(sales, lineKey).length;
}

/**
 * Pezzi che alimentano UNA riga di punteggio.
 *
 * Due deroghe rispetto al semplice qtyOf(sales, kpi.key):
 *  - `sourceLineKey` : conta un'altra pista (una pista può pesare su più righe);
 *  - `matchSubtype`  : conta solo le vendite di quel subtype (es. FWA_RIC, perché
 *                      il Top Club premia gli accessi FWA ricaricabile, non tutti).
 * Senza i due campi il risultato è identico a qtyOf(sales, kpi.key): le righe
 * che non li usano non cambiano comportamento.
 */
function qtyOfKpi(sales: Sale[], kpi: ScoreKpi): number {
  let mine = salesFor(sales, kpi.sourceLineKey ?? kpi.key);
  if (kpi.matchSubtype) mine = mine.filter((s) => s.subtype === kpi.matchSubtype);
  if (kpi.excludeSubtype) mine = mine.filter((s) => s.subtype !== kpi.excludeSubtype);
  if (kpi.excludeSubtypeIn?.length)
    mine = mine.filter((s) => !s.subtype || !kpi.excludeSubtypeIn!.includes(s.subtype));
  if (kpi.provenanceIn?.length) mine = mine.filter((s) => !!s.provenance && kpi.provenanceIn!.includes(s.provenance));
  if (kpi.provenanceNotIn?.length) mine = mine.filter((s) => !s.provenance || !kpi.provenanceNotIn!.includes(s.provenance));
  if (kpi.minFeeEur != null) mine = mine.filter((s) => (s.feeEur ?? 0) >= kpi.minFeeEur!);
  // Conteggio GREZZO di proposito: il punteggio va a PRATICA, non pesato. Il
  // peso 0,5 dell'FWA ricaricabile agisce sulla soglia della gara Fisso, non
  // sui punti del premio.
  return mine.length;
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
    const n = kpi.source === "DERIVED" ? qtyOfKpi(sales, kpi) : (inputs[kpi.key] ?? 0);
    points += n * kpi.points;
  }

  // cancelli in AND: mancarne uno azzera. Trova il messo peggio (per la UI).
  // Il conteggio è quello PESATO (weightedQtyOf): stessa identica definizione
  // della card "Cancelli Top Club", di buildOutlook e di prizeOpportunities.
  // Col conteggio grezzo il motore apriva cancelli che la UI dava per chiusi.
  let gateOpen = true;
  let worstGate: PrizeResult["worstGate"] = null;
  for (const gate of prize.gates) {
    const have = weightedQtyOf(sales, gate.lineKey);
    const missing = round2(Math.max(0, gate.minQty - have));
    if (missing > 0) {
      gateOpen = false;
      if (!worstGate || missing > worstGate.missing) worstGate = { lineKey: gate.lineKey, missing };
    }
  }

  // Premio A SCALINO, non interpolato (confermato da Lorenzo il 30/07): la
  // soglia si raggiunge o non si raggiunge. Top Club: sotto 180 zero, da 180
  // mille euro, da 300 tremila — a 299 punti si prendono mille euro, non 2.983.
  // Stessa meccanica sul Customer Base (200 → 200 €, 450 → 1.500 €).
  // Fino al 29/07 qui c'era un'interpolazione lineare che gonfiava il premio
  // di migliaia di euro in tutta la fascia intermedia.
  let base = 0;
  if (gateOpen) {
    if (points >= prize.maxPoints) base = prize.maxPrize;
    else if (points >= prize.minPoints) base = prize.minPrize;
  }

  // dimezzamenti condizionati da input mensili (Customer Base: up-selling < 8)
  for (const h of prize.halvings) {
    if ((inputs[h.inputKey] ?? 0) < h.minValue) base *= h.factor;
  }

  // bonus % condizionato dal volume di un'altra pista (Energia ≥4 → +30% Top
  // Club). Anche qui il volume è quello di gara (pesato): è la stessa soglia in
  // pezzi che la UI mostra sulla pista, non un secondo modo di contare.
  let bonus = 0;
  for (const b of prize.bonuses) {
    if (weightedQtyOf(sales, b.conditionLineKey) >= b.conditionMinQty) bonus += base * b.pct;
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

/** Extra/PxQ/malus a gettone fisso (§E.4).
 *  Conteggio GREZZO di proposito: il gettone si prende UNA volta per ogni
 *  pratica che matcha (è "€ per vendita", non "€ per pezzo di gara"). Il peso
 *  dei bundle multi-OTT è già dentro il compenso della pista Contenuti, che
 *  moltiplica per la qty pesata: pesare anche qui pagherebbe due volte. */
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

/** Addon a gettone condizionati dal CONTEGGIO di vendite che matchano (§E.4bis).
 *  Non per-pezzo: superata la soglia scatta una tantum. Gli addon dello stesso
 *  `group` sono scaglioni della stessa condizione → vale solo il € più alto.
 *  Conteggio GREZZO di proposito: la lettera dice "≥12 MNP con canone ≥9,99",
 *  cioè dodici PRATICHE. Gli addon in uso stanno tutti su piste a peso 1 (MNP),
 *  quindi grezzo e pesato coincidono comunque. */
function computeAddons(params: Params, sales: Sale[]): number {
  if (!params.addons) return 0;
  let sum = 0;
  const byGroup = new Map<string, number>();
  for (const a of params.addons) {
    const n = sales.filter(
      (s) =>
        (a.matchLineKey ? s.lineKey === a.matchLineKey : true) &&
        (a.minFeeEur != null ? (s.feeEur ?? 0) >= a.minFeeEur : true) &&
        (a.provenanceIn ? a.provenanceIn.includes(s.provenance ?? "") : true),
    ).length;
    if (n < a.minCount) continue;
    // L'addon si prende PER OGNI SIM che ha la caratteristica, non una volta
    // sola: «se >= 12 le mnp con offerta >=9,99€ allora +15€ (per ogni sim con
    // questa caratteristica)». La soglia decide SE si prende, il conteggio
    // decide QUANTO. Fino al 30/07 qui c'era un forfait, che a 34 MNP dava
    // 15 € invece di 510.
    const importo = round2(a.eur * n);
    // Gruppo = scaglioni alternativi sulla stessa condizione (Iliad/COOP a 7 e
    // a 14 pezzi): vale solo il più alto, non si sommano.
    if (a.group) byGroup.set(a.group, Math.max(byGroup.get(a.group) ?? 0, importo));
    else sum += importo;
  }
  for (const v of Array.from(byGroup.values())) sum += v;
  return round2(sum);
}

/** TIM: gare + extra + premi a punteggio. */
export function computeTim(plan: Plan, sales: Sale[], inputs: MonthlyInputs): MonthResult {
  const bill = plan.params.billSize;

  // penalità AL PP → MNP: se AL PP sotto soglia, i moltiplicatori MNP scendono.
  // La soglia si legge sullo STESSO numero che la UI mostra sulla pista AL PP,
  // cioè il conteggio di gara (su AL PP il peso è 1, quindi il valore non
  // cambia: usarlo qui serve a non avere due modi di contare la stessa pista).
  let mnpPenalty = 0;
  if (plan.params.alPpPenalty) {
    const alPpQty = weightedQtyOf(sales, "AL_PP");
    if (alPpQty < plan.params.alPpPenalty.threshold) mnpPenalty = plan.params.alPpPenalty.delta;
  }

  const lines: LineResult[] = plan.lines.map((line) => {
    const penalty = line.key === "MNP" ? mnpPenalty : 0;
    return computeTimLine(line, sales, bill, penalty);
  });

  const extras = round2(computeExtras(plan.params, sales) + computeAddons(plan.params, sales));
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
  /** Valorizzato quando questi pezzi sbloccano anche un premio a cancelli. */
  unlocksPrize?: string;
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

// ------------------------------------------------- attribuzione per vendita

export interface SaleAttribution {
  index: number;
  lineKey: string;
  compenso: number;
  /** false se la vendita non paga il gettone (bill size sotto la soglia). */
  paysGettone: boolean;
}

/**
 * Quanto vale OGNI SINGOLA vendita, dato lo stato del mese.
 *
 * Serve allo spaccato per categoria: senza questo, ripartire il compenso di una
 * gara fra le sue vendite significherebbe inventare (due MNP con canoni diversi
 * non valgono uguale). Usa esattamente le stesse formule di computeTim, quindi
 * la somma delle attribuzioni coincide col compenso della pista.
 *
 * Nota: sulle gare a soglia il valore di una vendita dipende dal VOLUME del
 * mese, non da quando è stata fatta. È corretto — è la rivalutazione
 * retroattiva delle gare TIM.
 */
export function attributeSales(plan: Plan, sales: Sale[], inputs: MonthlyInputs = {}): SaleAttribution[] {
  const isLinear = plan.engineVersion === "linear";
  const bill = plan.params.billSize;
  const out: SaleAttribution[] = [];

  // penalità AL PP: identica a computeTim (stesso conteggio di gara pesato)
  let mnpPenalty = 0;
  if (!isLinear && plan.params.alPpPenalty) {
    const alQty = weightedQtyOf(sales, "AL_PP");
    if (alQty < plan.params.alPpPenalty.threshold) mnpPenalty = plan.params.alPpPenalty.delta;
  }

  for (const line of plan.lines) {
    const mine = sales.map((s, i) => ({ s, i })).filter(({ s }) => s.lineKey === line.key);
    if (!mine.length) continue;
    const fwWeight = (s: Sale) => saleWeight(line.key, s.subtype);
    // stesso conteggio di gara di computeTimLine: le soglie si leggono uguali
    const qty = weightedQtyOf(sales, line.key);

    if (line.unit === "EUR_PER_PIECE") {
      const pxq = line.pxqEur ?? 0;
      const rate = tierValue(qty, line.tiers);
      for (const { s, i } of mine) {
        // sulle piste lineari il compenso può essere specifico dell'offerta
        const base = isLinear ? (s.unitCompenso ?? rate) : pxq + rate;
        out.push({ index: i, lineKey: line.key, compenso: round2(base), paysGettone: base > 0 });
      }
      continue;
    }

    // MULTIPLIER_ON_FEE
    const penalty = line.key === "MNP" ? mnpPenalty : 0;
    const mult = Math.max(0, tierValue(qty, line.tiers) - penalty);
    const domicVal = line.domiciliationValue ?? 0;
    const nonDom = line.nonDomiciledValue ?? 0;
    // Bill size di PISTA (media dei canoni del mese), non della singola SIM:
    // stessa definizione di computeTimLine.
    const bw = line.applyBillSize ? billWeightOfLine(mine.map((m) => m.s), bill) : 1;
    for (const { s, i } of mine) {
      const perUnit =
        line.domiciliationMode === "bonus"
          ? s.domiciled
            ? mult + domicVal
            : mult
          : line.domiciliationMode === "split"
            ? s.domiciled
              ? mult
              : nonDom
            : mult;
      out.push({
        index: i,
        lineKey: line.key,
        compenso: round2(perUnit * (s.feeEur ?? 0) * bw * fwWeight(s)),
        paysGettone: bw > 0,
      });
    }
  }

  return out;
}

// ------------------------------------------------- opportunità sui premi

export interface PrizeOpportunity {
  key: string;
  label: string;
  missingGates: { lineKey: string; missing: number }[];
  totalMissingPieces: number;
  pointsNow: number;
  /** Punteggio che avresti chiudendo tutti i cancelli mancanti. */
  pointsIfClosed: number;
  minPoints: number;
  /** € che prenderesti davvero chiudendo i cancelli. Zero se il punteggio
   *  resterebbe comunque sotto il minimo: i cancelli non bastano. */
  prizeIfClosed: number;
  /** false quando il premio resta 0 anche chiudendo tutto: non vale inseguirlo. */
  worthChasing: boolean;
}

/** Premio a scalino per un dato punteggio (senza considerare i cancelli).
 *  Deve restare identico alla logica di `computePrize`: la soglia si raggiunge
 *  o non si raggiunge, non esistono valori intermedi. */
function prizeAtPoints(prize: Prize, points: number): number {
  if (points >= prize.maxPoints) return round2(prize.maxPrize);
  if (points >= prize.minPoints) return round2(prize.minPrize);
  return 0;
}

/**
 * Cosa servirebbe davvero per prendere un premio, e se ne vale la pena.
 *
 * Il punto delicato: chiudere i cancelli fa anche SALIRE il punteggio, perché
 * i pezzi mancanti portano punti. Ma può non bastare — e saperlo vale quanto
 * il premio stesso, perché dice quando smettere di inseguirlo.
 */
export function prizeOpportunities(plan: Plan, result: MonthResult): PrizeOpportunity[] {
  // `LineResult.qty` è già il conteggio di gara pesato (weightedQtyOf): stessa
  // identica definizione usata dai cancelli in computePrize e dalla UI.
  const qtyOf = new Map(result.lines.map((l) => [l.key, l.qty]));
  const out: PrizeOpportunity[] = [];

  for (const prize of plan.prizes) {
    if (!prize.gates.length) continue;
    const pr = result.prizes.find((p) => p.key === prize.key);
    if (pr?.gateOpen) continue;

    const missingGates = prize.gates
      .map((g) => ({ lineKey: g.lineKey, missing: Math.max(0, g.minQty - (qtyOf.get(g.lineKey) ?? 0)) }))
      .filter((g) => g.missing > 0)
      .sort((a, b) => b.missing - a.missing);
    if (!missingGates.length) continue;

    const pointsNow = pr?.points ?? 0;
    // i pezzi mancanti portano punti: quanto salirebbe il punteggio. Una pista
    // può alimentare PIÙ righe (MNP: 2 pt "No ICP" + 1,5 pt "Val"), quindi i
    // punti per pezzo sono la SOMMA delle righe che contano quella pista.
    const extra = missingGates.reduce((a, g) => {
      const perPiece = prize.scoreKpis
        .filter((k) => k.source === "DERIVED" && (k.sourceLineKey ?? k.key) === g.lineKey)
        .reduce((s, k) => s + k.points, 0);
      return a + g.missing * perPiece;
    }, 0);
    const pointsIfClosed = round2(pointsNow + extra);
    const prizeIfClosed = prizeAtPoints(prize, pointsIfClosed);

    out.push({
      key: prize.key,
      label: prize.label,
      missingGates,
      totalMissingPieces: missingGates.reduce((a, g) => a + g.missing, 0),
      pointsNow: round2(pointsNow),
      pointsIfClosed,
      minPoints: prize.minPoints,
      prizeIfClosed,
      worthChasing: prizeIfClosed > 0,
    });
  }

  return out;
}

/**
 * Focus consapevole dei cancelli: se una pista è l'ULTIMO cancello mancante di
 * un premio che vale davvero, il suo valore non è lo scatto di gara ma il
 * premio intero. Senza questo, il consiglio manda a fare 6 Telepass da 20 €
 * ignorando che quegli stessi 6 aprono un premio da 1.300 €.
 */
export function focusNowWithPrizes(plan: Plan, result: MonthResult): FocusItem[] {
  const base = focusNow(plan, result);
  const byKey = new Map(base.map((f) => [f.lineKey, { ...f }]));
  const opps = prizeOpportunities(plan, result);

  for (const o of opps) {
    if (!o.worthChasing) continue;
    // il premio si attribuisce a una pista sola quando è l'unico cancello che
    // manca: se ne mancano due, arrivarci dipende da entrambe e attribuirlo a
    // una delle due gonfierebbe il consiglio.
    if (o.missingGates.length !== 1) continue;
    const g = o.missingGates[0];
    const line = result.lines.find((l) => l.key === g.lineKey);
    const existing = byKey.get(g.lineKey);
    const stepValue = round2((existing?.stepValue ?? 0) + o.prizeIfClosed);
    byKey.set(g.lineKey, {
      lineKey: g.lineKey,
      label: line?.label ?? g.lineKey,
      missing: g.missing,
      stepValue,
      priority: round2(stepValue / Math.max(1, g.missing)),
      unlocksPrize: o.label,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => b.priority - a.priority);
}
