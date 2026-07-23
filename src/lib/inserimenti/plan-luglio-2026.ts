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
      pxqEur: 0,
      status: "ATTIVA",
      statusNote: "In vendita (Luce e Gas)",
      rules:
        "Gara a soglia, gettone TUTTO COMPRESO per contratto: ≥4 → 110€, ≥8 → 130€ (rivalutazione retroattiva su tutti). Sotto 4 non paga. Luce+gas (dual) = due contratti. Alimenta il +30% del Top Club a ≥4 contratti.",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 4, value: 110 },
        { minQty: 8, value: 130 },
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
      pxqEur: 0,
      status: "IN_ABILITAZIONE",
      statusNote: "Dispositivi in spedizione",
      rules:
        "Gara a soglia, gettone TUTTO COMPRESO: da 8 pezzi in su 25€ a pezzo (le due soglie ≥8 e ≥15 valgono entrambe 25€). Sotto 8 non paga. TWIN 10€ e Assistenza Europa 5€ restano come extra separati. Cancello del Top Club (≥8).",
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 8, value: 25 },
        { minQty: 15, value: 25 },
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
      maxPrize: 3000,
      rules:
        "Lettera luglio: soglia 1 = 180 pt → 1.000€, soglia 2 = 300 pt → 3.000€ (interpolato). CANCELLI IN AND (azzerano il premio se mancano): Accessi ≥16, MNP ≥34, Telepass ≥8. +30% se Energia ≥4. " +
        "Punteggi lettera (per il calcolo live uso quelli deducibili dalle vendite; gli altri servono a mano dal consuntivo): Acc.netto FWA Ric 4 · SMB Fix 4 · TIM FIN 4 · Telepass 4 · Trasf. da prop. 3 · MNVO ICP 3 · MNP No ICP 2 · MNP KENA 2 · MNP Val 1,5 · AL PP net 0,5.",
      gates: [
        { lineKey: "ACCESSO_FISSO", minQty: 16 },
        { lineKey: "MNP", minQty: 34 },
        { lineKey: "TELEPASS_FAMILY", minQty: 8 },
      ],
      scoreKpis: [
        { key: "ACCESSO_FISSO", label: "Accessi (FWA ric / SMB Fix)", points: 4, source: "DERIVED", sortOrder: 10 },
        { key: "TIMFIN", label: "TIM Fin", points: 4, source: "DERIVED", sortOrder: 20 },
        { key: "TELEPASS_FAMILY", label: "Telepass", points: 4, source: "DERIVED", sortOrder: 30 },
        { key: "MNP", label: "MNP (No ICP)", points: 2, source: "DERIVED", sortOrder: 40 },
        { key: "AL_PP", label: "AL PP net", points: 0.5, source: "DERIVED", sortOrder: 50 },
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
      maxPrize: 1500,
      rules:
        "Lettera luglio: soglia 1 = 200 pt → 200€, soglia 2 = 450 pt → 1.500€ (interpolato). Soglia minima 8 Prop. Mobile/mese (cambio offerta + add-on dati): sotto 8 il premio è dimezzato. KPI da consuntivo TIM (M+1), inseriti a mano.",
      gates: [],
      scoreKpis: [
        { key: "cb.trasfFibra", label: "Trasf. FIBRA prop.", points: 15, source: "MANUAL", sortOrder: 10 },
        { key: "cb.trasfFibraFwa", label: "Trasf. FIBRA FWA prop.", points: 15, source: "MANUAL", sortOrder: 20 },
        { key: "cb.timfinFix", label: "TIMFin Fix", points: 10, source: "MANUAL", sortOrder: 30 },
        { key: "cb.timfinMobProOff", label: "TIMFin Mob pro e off.", points: 10, source: "MANUAL", sortOrder: 40 },
        { key: "cb.accMobOnly", label: "ACC Mob. Only", points: 10, source: "MANUAL", sortOrder: 50 },
        { key: "cb.mnpFixOnly", label: "MNP Fix Only", points: 10, source: "MANUAL", sortOrder: 60 },
        { key: "cb.altroPropFix", label: "Altro Prop. Fix", points: 10, source: "MANUAL", sortOrder: 70 },
        { key: "cb.propMobUpSell", label: "Prop. Mob. Up Sel. (cambio offerta - ME)", points: 6, source: "MANUAL", sortOrder: 80 },
        { key: "cb.propFixCont", label: "Prop. Fix Cont.", points: 6, source: "MANUAL", sortOrder: 90 },
        { key: "cb.propMobDA", label: "Prop. Mob. D-A", points: 3, source: "MANUAL", sortOrder: 100 },
        { key: "cb.timfinMobProp", label: "TIMFin Mob. prop.", points: 3, source: "MANUAL", sortOrder: 110 },
        { key: "cb.timUnica", label: "TIM Unica", points: 2, source: "MANUAL", sortOrder: 120 },
        { key: "cb.opzCbFix", label: "Opz. su CB Fix", points: 2, source: "MANUAL", sortOrder: 130 },
        { key: "cb.subMob", label: "Sub Mob.", points: 1, source: "MANUAL", sortOrder: 140 },
        { key: "cb.ricAutoCb", label: "Ric. Auto CB", points: 1, source: "MANUAL", sortOrder: 150 },
      ],
      bonuses: [],
      halvings: [{ inputKey: "cb.upsellingVolume", minValue: 8, factor: 0.5, label: "Prop. Mobile < 8 → premio dimezzato" }],
    },
  ],
  params: [
    { key: "billSize", valueJson: { full: 9, half: 8 } },
    { key: "alPpPenalty", valueJson: { threshold: 16, delta: 0.5 } },
    {
      key: "extras",
      valueJson: [
        // La qualitativa Energia (70€) è ora inglobata nel gettone "tutto compreso" (110/130).
        { key: "telepass_twin", eur: 10, matchLineKey: "TELEPASS_TWIN" },
        { key: "telepass_europa", eur: 5, matchLineKey: "TELEPASS_EUROPA" },
        { key: "al_etnica", eur: 10, matchLineKey: "AL_ETNICA" },
        { key: "prime_pxq", eur: 3, matchLineKey: "CONTENUTI", matchSubtype: "PRIME" },
        { key: "trasformazione", eur: 50, matchLineKey: "TRASFORMAZIONE" },
        { key: "accesso_moroso", eur: -50, matchLineKey: "ACCESSO_MOROSO" },
      ],
    },
    {
      // Addon MNP dalla lettera luglio: bonus una tantum sul CONTEGGIO, non per-pezzo.
      // Il gruppo "mnp_iliad_coop" è a scaglioni: vale solo il € più alto raggiunto
      // (≥14 → 15€, non 15+5). L'addon canone≥9,99 è indipendente e si somma.
      key: "addons",
      valueJson: [
        { key: "mnp_bill_alto", eur: 15, matchLineKey: "MNP", minFeeEur: 9.99, minCount: 12 },
        { key: "mnp_iliad_coop_7", eur: 5, matchLineKey: "MNP", provenanceIn: ["ILIAD", "COOP"], minCount: 7, group: "mnp_iliad_coop" },
        { key: "mnp_iliad_coop_14", eur: 15, matchLineKey: "MNP", provenanceIn: ["ILIAD", "COOP"], minCount: 14, group: "mnp_iliad_coop" },
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
// Valori 2023 (piano Computer Net), da aggiornare col 2026. Le piste business
// pagano 5 × canone (indicazione Lorenzo, in attesa del business TIM). Tutte le
// piste stanno QUI nel seed così sopravvivono a un re-seed (prima vivevano in un
// import separato e venivano cancellate a ogni riseed).
const FASTWEB: SeedPlan = {
  brand: "FASTWEB",
  month: MONTH,
  label: "Fastweb — via mandato C.Net (scaglione massimo)",
  status: "ACTIVE",
  engineVersion: "linear",
  notes:
    "Compensi STIMATI e non garantiti: dipendono dalle soglie di gruppo C.Net e possono cambiare in corsa. Valori 2023 da aggiornare. Business = 5 × canone.",
  lines: [
    { key: "MOBILE", label: "Fastweb Mobile", category: "Mobile", unit: "EUR_PER_PIECE", hasTiers: false, rules: "Ricarica Automatica, scaglione ≥220 del piano C.Net 2023. Stima non garantita.", tiers: [{ minQty: 0, value: 48 }], sortOrder: 10 },
    { key: "TEL_INC", label: "Fastweb Telefono incluso", category: "Rate", unit: "EUR_PER_PIECE", hasTiers: false, rules: "Pista monitorata, senza target.", tiers: [{ minQty: 0, value: 48 }], sortOrder: 20 },
    { key: "FISSO", label: "Fastweb Fisso", category: "Fisso", unit: "EUR_PER_PIECE", hasTiers: false, rules: "NeXXt Casa scaglione ≥46 del piano C.Net 2023. Stima non garantita.", tiers: [{ minQty: 0, value: 180 }], sortOrder: 30 },
    { key: "ENERGIA", label: "Fastweb Energia (luce o gas)", category: "Energia", unit: "EUR_PER_PIECE", hasTiers: false, rules: "100 € a contratto (indicazione Lorenzo). Da confermare col piano 2026.", tiers: [{ minQty: 0, value: 100 }], sortOrder: 40 },
    { key: "FISSO_BUSINESS", label: "Fastweb Fisso business", category: "Fisso", unit: "MULTIPLIER_ON_FEE", hasTiers: false, rules: "5 × canone (indicazione Lorenzo, in attesa del business TIM). Da confermare.", tiers: [{ minQty: 0, value: 5 }], sortOrder: 50 },
    { key: "MOBILE_BUSINESS", label: "Fastweb Mobile business", category: "Mobile", unit: "MULTIPLIER_ON_FEE", hasTiers: false, rules: "5 × canone. Es. 12,95 € → 64,75 € a SIM.", tiers: [{ minQty: 0, value: 5 }], sortOrder: 60 },
    { key: "ENERGIA_BUSINESS", label: "Fastweb Energia business", category: "Energia", unit: "EUR_PER_PIECE", hasTiers: false, rules: "⚠️ Compenso da confermare.", tiers: [{ minQty: 0, value: 0 }], sortOrder: 70 },
  ],
  prizes: [],
  params: [],
};

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
