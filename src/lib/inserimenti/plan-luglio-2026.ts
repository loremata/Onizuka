/**
 * Piano provvigionale LUGLIO 2026 — dati di seed.
 *
 * Fonti (in ordine di autorità per i VALORI):
 *  1. Avanzamento gara di Mirko Ceccherini al 10/07/2026 (soglie in pezzi "per la
 *     vs insegna" — decisione utente 17/07: "prendi per buone le soglie di Mirko").
 *  2. Mail incentivazione di Mirko (struttura completa di gare, extra, Top Club).
 *  3. Lettere .docx Multibrand luglio 2026 (moltiplicatori/gettoni).
 *
 * ⚠️ Valori da riverificare con Lorenzo/Mirko (vedi Onizuka-Inserimenti_DOMANDE-APERTE):
 *  - MNP/AL/Contenuti: soglie in PEZZI dall'avanzamento (più basse delle lettere).
 *  - Eni Telepass 5 € è provvisorio; Fastweb usa i valori 2023 (scaglione massimo).
 *
 * Questo file è DATO, non logica: il motore (engine.ts) lo consuma. A luglio+1
 * si duplica e si correggono i numeri, senza toccare il codice.
 */

export type SeedUnit = "MULTIPLIER_ON_FEE" | "EUR_PER_PIECE";
export type SeedDomicMode = "bonus" | "split";

export interface SeedTier {
  minQty: number;
  value: number;
}

export interface SeedLine {
  key: string;
  label: string;
  category?: string;
  unit: SeedUnit;
  hasTiers: boolean;
  target?: number;
  status?: "ATTIVA" | "IN_ABILITAZIONE" | "NON_ABILITATA" | "BLOCCATA";
  statusNote?: string;
  rules?: string;
  applyBillSize?: boolean;
  domiciliationMode?: SeedDomicMode;
  domiciliationValue?: number;
  nonDomiciledValue?: number;
  pxqEur?: number;
  tiers: SeedTier[];
  sortOrder: number;
}

export interface SeedGate {
  lineKey: string;
  minQty: number;
}
export interface SeedKpi {
  key: string;
  label: string;
  points: number;
  source: "DERIVED" | "MANUAL";
  sortOrder: number;
}
export interface SeedBonus {
  conditionLineKey: string;
  conditionMinQty: number;
  pct: number;
  label?: string;
}
export interface SeedHalving {
  inputKey: string;
  minValue: number;
  factor: number;
  label?: string;
}
export interface SeedPrize {
  key: "TOP_CLUB" | "CUSTOMER_BASE";
  label: string;
  minPoints: number;
  maxPoints: number;
  minPrize: number;
  maxPrize: number;
  rules?: string;
  gates: SeedGate[];
  scoreKpis: SeedKpi[];
  bonuses: SeedBonus[];
  halvings: SeedHalving[];
}
export interface SeedParam {
  key: string;
  valueJson: unknown;
}
export interface SeedPlan {
  brand: "TIM" | "KENA" | "FASTWEB" | "ENEL" | "ENI" | "ILIAD";
  month: string;
  label: string;
  sourceDoc?: string;
  status: "PROVISIONAL" | "ACTIVE" | "ARCHIVED";
  engineVersion: string;
  notes?: string;
  lines: SeedLine[];
  prizes: SeedPrize[];
  params: SeedParam[];
}

const MONTH = "2026-07";

// ============================================================ TIM (gare a soglie)

const TIM: SeedPlan = {
  brand: "TIM",
  month: MONTH,
  label: "TIM — Incentivazione Luglio 2026 (Multibrand)",
  sourceDoc: "Avanzamento gara Mirko 10/07/2026 + mail incentivazione + lettere .docx luglio",
  status: "ACTIVE",
  engineVersion: "tim-2026-07",
  notes:
    "Soglie in pezzi dall'avanzamento di Mirko (più basse delle lettere). Moltiplicatori dalle lettere. Da riverificare: se le soglie sono di insegna o di PdV (§M spec).",
  lines: [
    {
      key: "MNP",
      label: "Mobile MNP",
      category: "Mobile",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      target: 34,
      applyBillSize: true,
      domiciliationMode: "bonus",
      domiciliationValue: 1.2,
      rules:
        "Moltiplicatore × somma canoni. Domiciliato +1,2. Bill size: ≥9€ pieno, 8-8,99 metà, <8 escluso (nel listino TIM non c'è nulla tra 8 e 9: o pieno o zero). Se AL PP < soglia 2 (16), tutte le MNP perdono 0,5. Kena alza la soglia ma non paga gara.",
      tiers: [
        { minQty: 0, value: 1.2 },
        { minQty: 19, value: 2.3 },
        { minQty: 34, value: 2.9 },
        { minQty: 59, value: 4.0 },
        { minQty: 104, value: 5.2 },
        { minQty: 154, value: 5.8 },
      ],
      sortOrder: 10,
    },
    {
      key: "AL_PP",
      label: "Mobile AL PP Nette",
      category: "Mobile",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      target: 16,
      applyBillSize: true,
      domiciliationMode: "bonus",
      domiciliationValue: 1.5,
      rules:
        "Nuove attivazioni (non portabilità). Moltiplicatore × canoni. Domiciliato +1,5. Bill size come MNP. Sotto soglia 2 (16 pezzi) penalizza tutte le MNP di -0,5.",
      tiers: [
        { minQty: 0, value: 0.2 },
        { minQty: 15, value: 0.6 },
        { minQty: 35, value: 2.1 },
        { minQty: 70, value: 2.3 },
        { minQty: 110, value: 2.5 },
      ],
      sortOrder: 20,
    },
    {
      key: "ACCESSO_FISSO",
      label: "Accessi Fisso",
      category: "Fisso",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      target: 16,
      applyBillSize: false,
      domiciliationMode: "split",
      nonDomiciledValue: 1.7,
      rules:
        "Domiciliati: moltiplicatore a scaglione × canoni. Non domiciliati: sempre 1,7 × canone. FWA ricaricabile pesa 0,5 per la soglia. +50€ PxQ per TIM WiFi GO in abbinata FTTH (M+4).",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 3, value: 1.7 },
        { minQty: 8, value: 4.5 },
        { minQty: 16, value: 5.0 },
        { minQty: 26, value: 6.5 },
      ],
      sortOrder: 30,
    },
    {
      key: "CONTENUTI",
      label: "Contenuti (TIMVision)",
      category: "Contenuti",
      unit: "EUR_PER_PIECE",
      hasTiers: true,
      target: 22,
      pxqEur: 0,
      rules:
        "Gettone a soglia. Serve ≥75% attivo/registrato, altrimenti premio al 50%. Prime NON prende il gettone (solo PxQ 3€). Dazn completo pesa ×3 per la soglia, MyClub ×2. ATTENZIONE: la qty pesata non è ancora nel motore.",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 15, value: 5 },
        { minQty: 22, value: 7.5 },
        { minQty: 24, value: 10 },
        { minQty: 26, value: 20 },
      ],
      sortOrder: 40,
    },
    {
      key: "TIMFIN",
      label: "TIMFin (gara VALORE)",
      category: "Rate",
      unit: "EUR_PER_PIECE",
      hasTiers: true,
      target: 16,
      pxqEur: 0,
      status: "IN_ABILITAZIONE",
      statusNote: "Abilitazione a giorni",
      rules:
        "Telefono a rate. Gettone a soglia sul volume mensile. Pack 2x1 pesa ×2, pack X3 ×3. Rata ≤2€: solo soglia, gettone fisso 15€.",
      tiers: [
        { minQty: 0, value: 15 },
        { minQty: 13, value: 20 },
        { minQty: 16, value: 30 },
        { minQty: 25, value: 35 },
        { minQty: 40, value: 50 },
      ],
      sortOrder: 50,
    },
    {
      key: "ENERGIA",
      label: "TIM Energia",
      category: "Energia",
      unit: "EUR_PER_PIECE",
      hasTiers: true,
      target: 4,
      pxqEur: 10,
      status: "NON_ABILITATA",
      statusNote: "Da iniziare a vendere (un paio di contratti da inserire)",
      rules:
        "PxQ 10€ + qualitativa 70€ (extra, M+3) + volume. Luglio: PxQ sceso da 20 a 10. Luce+gas (dual) = doppio. Alimenta il +30% del Top Club a ≥4 contratti.",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 4, value: 20 },
        { minQty: 8, value: 40 },
      ],
      sortOrder: 60,
    },
    {
      key: "TELEPASS_FAMILY",
      label: "Telepass Family",
      category: "Telepass",
      unit: "EUR_PER_PIECE",
      hasTiers: true,
      target: 8,
      pxqEur: 20,
      status: "IN_ABILITAZIONE",
      statusNote: "Dispositivi in spedizione",
      rules:
        "Nuovo contratto Family: PxQ 20€ + volume. TWIN 10€ e Assistenza Europa 5€ come extra. Cancello del Top Club (≥8).",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 8, value: 10 },
        { minQty: 15, value: 20 },
      ],
      sortOrder: 70,
    },
    {
      key: "TIM_UNICA",
      label: "TIM Unica",
      category: "Convergenza",
      unit: "EUR_PER_PIECE",
      hasTiers: true,
      target: 5,
      pxqEur: 0,
      rules: "Gettone a soglia sul volume: ≥5 → 5€, ≥10 → 10€ per pezzo.",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 5, value: 5 },
        { minQty: 10, value: 10 },
      ],
      sortOrder: 80,
    },
  ],
  prizes: [
    {
      key: "TOP_CLUB",
      label: "Top Club",
      minPoints: 180,
      maxPoints: 300,
      minPrize: 1000,
      maxPrize: 2000,
      rules:
        "Premio 1.000→2.000€ interpolato sul punteggio 180→300. CANCELLI IN AND: mancarne uno azzera il premio. +30% se Energia ≥ soglia 1 (4). Kena vale 2 punti.",
      gates: [
        { lineKey: "ACCESSO_FISSO", minQty: 16 },
        { lineKey: "MNP", minQty: 34 },
        { lineKey: "TELEPASS_FAMILY", minQty: 8 },
      ],
      scoreKpis: [
        { key: "ACCESSO_FISSO", label: "Accessi Consumer", points: 4, source: "DERIVED", sortOrder: 10 },
        { key: "TIMFIN", label: "TIMFin", points: 4, source: "DERIVED", sortOrder: 20 },
        { key: "TELEPASS_FAMILY", label: "Telepass Family", points: 4, source: "DERIVED", sortOrder: 30 },
        { key: "MNP", label: "MNP (netto MVNO)", points: 2, source: "DERIVED", sortOrder: 40 },
        { key: "AL_PP", label: "AL PP Nette", points: 0.5, source: "DERIVED", sortOrder: 50 },
      ],
      bonuses: [{ conditionLineKey: "ENERGIA", conditionMinQty: 4, pct: 0.3, label: "+30% Energia" }],
      halvings: [],
    },
    {
      key: "CUSTOMER_BASE",
      label: "Customer Base / Proponi",
      minPoints: 200,
      maxPoints: 450,
      minPrize: 200,
      maxPrize: 1000,
      rules:
        "Premio 200→1.000€ sul punteggio 200→450. KPI da consuntivo TIM (M+1), inseriti a mano. Se volume Up-Selling < 8 il premio è dimezzato.",
      gates: [],
      scoreKpis: [
        { key: "cb.trasfFibra", label: "Trasf. Fibra da Proponi", points: 15, source: "MANUAL", sortOrder: 10 },
        { key: "cb.trasfFwa", label: "Trasf. FWA da Proponi", points: 15, source: "MANUAL", sortOrder: 20 },
        { key: "cb.timfinFisso", label: "TIMFin Fisso", points: 10, source: "MANUAL", sortOrder: 30 },
        { key: "cb.proponiMobileUp", label: "Proponi Mobile Up-Selling/ME", points: 6, source: "MANUAL", sortOrder: 40 },
        { key: "cb.proponiMobileDati", label: "Proponi Mobile Dati/Altre", points: 3, source: "MANUAL", sortOrder: 50 },
        { key: "cb.timUnicaCb", label: "TIM Unica Mobile CB", points: 2, source: "MANUAL", sortOrder: 60 },
        { key: "cb.ricaricaAuto", label: "Ricarica Automatica (CB)", points: 1, source: "MANUAL", sortOrder: 70 },
      ],
      bonuses: [],
      halvings: [{ inputKey: "cb.upsellingVolume", minValue: 8, factor: 0.5, label: "Up-Selling < 8 → premio dimezzato" }],
    },
  ],
  params: [
    { key: "billSize", valueJson: { full: 9, half: 8 } },
    { key: "alPpPenalty", valueJson: { threshold: 16, delta: 0.5 } },
    {
      key: "extras",
      valueJson: [
        { key: "energia_qualitativa", eur: 70, matchLineKey: "ENERGIA" },
        { key: "telepass_twin", eur: 10, matchLineKey: "TELEPASS_TWIN" },
        { key: "telepass_europa", eur: 5, matchLineKey: "TELEPASS_EUROPA" },
        { key: "al_etnica", eur: 10, matchLineKey: "AL_ETNICA" },
        { key: "prime_pxq", eur: 3, matchLineKey: "CONTENUTI", matchSubtype: "PRIME" },
        { key: "trasformazione", eur: 50, matchLineKey: "TRASFORMAZIONE" },
        { key: "accesso_moroso", eur: -50, matchLineKey: "ACCESSO_MOROSO" },
      ],
    },
  ],
};

// ============================================================ brand LINEARI

const linear = (
  brand: SeedPlan["brand"],
  label: string,
  lines: Array<{ key: string; label: string; category: string; eur: number; sortOrder: number; note?: string }>,
  notes?: string,
): SeedPlan => ({
  brand,
  month: MONTH,
  label,
  status: "ACTIVE",
  engineVersion: "linear",
  notes,
  lines: lines.map((l) => ({
    key: l.key,
    label: l.label,
    category: l.category,
    unit: "EUR_PER_PIECE",
    hasTiers: false,
    rules: l.note,
    tiers: [{ minQty: 0, value: l.eur }],
    sortOrder: l.sortOrder,
  })),
  prizes: [],
  params: [],
});

// Fastweb: mandato C.Net, soglie di gruppo già sfondate → scaglione massimo.
// Valori 2023 (piano Computer Net), da aggiornare col 2026.
const FASTWEB = linear(
  "FASTWEB",
  "Fastweb — via mandato C.Net (scaglione massimo)",
  [
    { key: "MOBILE", label: "Fastweb Mobile", category: "Mobile", eur: 48, sortOrder: 10, note: "Ricarica Automatica, scaglione ≥220 del piano C.Net 2023. Stima non garantita." },
    { key: "TEL_INC", label: "Fastweb Telefono incluso", category: "Rate", eur: 48, sortOrder: 20, note: "Pista monitorata, senza target." },
    { key: "FISSO", label: "Fastweb Fisso", category: "Fisso", eur: 180, sortOrder: 30, note: "NeXXt Casa scaglione ≥46 del piano C.Net 2023. Stima non garantita." },
  ],
  "Compensi STIMATI e non garantiti: dipendono dalle soglie di gruppo C.Net e possono cambiare in corsa. Valori 2023 da aggiornare.",
);

const ENEL = linear("ENEL", "Enel — Energia", [
  { key: "ENERGIA", label: "Enel Energia (luce o gas)", category: "Energia", eur: 90, sortOrder: 10, note: "90€ a contratto, luce o gas." },
]);

const ENI = linear(
  "ENI",
  "Eni — Telepass",
  [{ key: "TELEPASS", label: "Eni Telepass", category: "Telepass", eur: 5, sortOrder: 10, note: "5€ PROVVISORIO, dato da confermare." }],
  "⚠️ Compenso Telepass provvisorio (5€), da confermare. È il prodotto n.1 per volume.",
);

const ILIAD = linear(
  "ILIAD",
  "Iliad — MNP",
  [{ key: "MNP", label: "Iliad MNP", category: "Mobile", eur: 15, sortOrder: 10, note: "Solo casi estremi, su richiesta diretta." }],
);

export const PLANS_LUGLIO_2026: SeedPlan[] = [TIM, FASTWEB, ENEL, ENI, ILIAD];
