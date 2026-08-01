/**
 * Piano provvigionale LUGLIO 2026 — dati di seed.
 *
 * Fonti (in ordine di autorità per i VALORI):
 *  1. "Incentivazione TIM" (Lorenzo, 23/07/2026) — divisione DEFINITIVA delle piste:
 *     soglie in pezzi e valore di ogni scaglione, gara per gara.
 *  2. Foglio [INSERIMENTI TIM] (tab "Compensi", 25/07/2026) — stessa tabella, più
 *     l'indicazione di COME si paga ogni pista (vedi sotto).
 *  3. Mail incentivazione di Mirko (extra, penalità incrociate, bill size, Top Club:
 *     cose che i due documenti sopra non coprono).
 *
 * Come si paga (dalla colonna "canoni" del tab Compensi):
 *  - MULTIPLIER_ON_FEE — AL, MNP, Fisso: canone dell'offerta × moltiplicatore
 *    della soglia raggiunta, retroattivo su tutto il mese.
 *  - EUR_PER_PIECE — Customer Base, Top Club, Contenuti, Energia, Valore,
 *    Telepass, Unica: gettone fisso PxQ (o premio secco, per i due a punteggio).
 *
 * ⚠️ Valori ancora da riverificare con Lorenzo/Mirko:
 *  - Domiciliazione: i due documenti definitivi NON la nominano. Qui i tier sono
 *    modellati come "valore documento − bonus domiciliazione" (vedi nota sulle
 *    righe MNP/AL): se invece il moltiplicatore del documento vale per TUTTE le
 *    vendite, domiciliate o no, il motore sta sottopagando le non domiciliate.
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
  /** Pista da contare, se diversa da `key` (una pista può pesare su due righe). */
  sourceLineKey?: string;
  /** Conta solo le vendite con questo subtype (es. "FWA_RIC"). */
  matchSubtype?: string;
  /** Conta tutte le vendite TRANNE quelle con questo subtype. */
  excludeSubtype?: string;
  /** Esclude più subtype insieme. */
  excludeSubtypeIn?: string[];
  /** Conta solo queste provenienze. */
  provenanceIn?: string[];
  /** Esclude queste provenienze. */
  provenanceNotIn?: string[];
  /** Canone minimo perché il punto spetti. */
  minFeeEur?: number;
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
  sourceDoc: "Incentivazione TIM 23/07/2026 (divisione definitiva piste) + tab Compensi di [INSERIMENTI TIM] + mail incentivazione Mirko",
  status: "ACTIVE",
  engineVersion: "tim-2026-07",
  notes:
    "Soglie e valori allineati alla divisione definitiva delle piste (23/07). Restano da riverificare: (a) se i moltiplicatori del documento siano già comprensivi di domiciliazione; (b) se le soglie siano di insegna o di PdV (§M spec). " +
    "KENA: canale separato, incentivazione ancora ignota, ma ha due paletti da rispettare — AL ≥2 e MNP ≥8. Le MNP Kena alzano la soglia MNP TIM e valgono 2 pt Top Club, senza pagare la gara TIM.",
  lines: [
    {
      key: "MNP",
      label: "Mobile MNP",
      category: "Mobile",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      target: 37,
      applyBillSize: true,
      domiciliationMode: "bonus",
      domiciliationValue: 1.2,
      rules:
        "Moltiplicatore × somma canoni. Domiciliato +1,2. Bill size: è la MEDIA dei canoni della gara nel mese — ≥9€ gettone pieno su tutte, 8-8,99 al 50% su tutte, sotto 8 niente. Se AL PP < soglia 2 (16), tutte le MNP perdono 0,5. Kena alza la soglia ma non paga gara. " +
        "Addon confermati dal documento definitivo: ≥12 MNP con canone ≥9,99€ → +15€; ≥7 MNP da Iliad/COOP → +5€, che salgono a +15€ da 14 in su.",
      // Documento definitivo: 2,4 · 3,5 · 4,1 · 5,2 · 6,4 · 7 canoni.
      // Qui ogni tier è quel valore MENO il bonus domiciliazione (1,2): una MNP
      // domiciliata torna esatta al documento, una non domiciliata prende meno.
      // LETTERA TIM luglio 2026 (Lorenzo 31/07: vale la lettera, non la mail di
      // avanzamento né il documento aziendale, che davano 19/34/59/104/154).
      tiers: [
        { minQty: 0, value: 1.2 },
        { minQty: 21, value: 2.3 },
        { minQty: 37, value: 2.9 },
        { minQty: 65, value: 4.0 },
        { minQty: 110, value: 5.2 },
        { minQty: 160, value: 5.8 },
      ],
      sortOrder: 10,
    },
    {
      key: "AL_PP",
      label: "Mobile AL PP Nette",
      category: "Mobile",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      target: 37,
      applyBillSize: true,
      domiciliationMode: "bonus",
      domiciliationValue: 1.5,
      rules:
        "Nuove attivazioni (non portabilità). Moltiplicatore × canoni. Domiciliato +1,5. Bill size come MNP. Sotto soglia 2 (16 pezzi) penalizza tutte le MNP di -0,5.",
      // Documento definitivo: 1,7 · 2,1 · 3,6 · 3,8 · 4 canoni, meno il bonus
      // domiciliazione (1,5) come per le MNP.
      // LETTERA TIM luglio 2026 (prima 15/35/70/110, dal documento aziendale).
      tiers: [
        { minQty: 0, value: 0.2 },
        { minQty: 16, value: 0.6 },
        { minQty: 37, value: 2.1 },
        { minQty: 75, value: 2.3 },
        { minQty: 115, value: 2.5 },
      ],
      sortOrder: 20,
    },
    {
      key: "ACCESSO_FISSO",
      label: "Accessi Fisso",
      category: "Fisso",
      unit: "MULTIPLIER_ON_FEE",
      hasTiers: true,
      target: 17,
      applyBillSize: false,
      domiciliationMode: "split",
      nonDomiciledValue: 1.7,
      rules:
        "Domiciliati: moltiplicatore a scaglione × canoni. Non domiciliati: sempre 1,7 × canone. +50€ PxQ per TIM WiFi GO in abbinata FTTH (M+4). " +
        "TRE SOTTOTIPI contano per la soglia ma NON prendono il gettone (lettera luglio 2026): FWA ricaricabile (pesa 0,5), linee PMI fisso/SMB, trasformazioni fibra da proponi. " +
        "⚠️ NON MODELLATO: le linee PMI valgono per la soglia solo fino al 40% del consuntivo linee Consumer.",
      // LETTERA TIM luglio 2026: ≥3 · ≥9 · ≥17 · ≥27. La mail di avanzamento di
      // Mirko diceva 8 sulla soglia 2 ed era un errore (confermato il 31/07):
      // Onizuka dava per superata una soglia che non lo era.
      tiers: [
        { minQty: 0, value: 0 },
        { minQty: 3, value: 1.7 },
        { minQty: 9, value: 4.5 },
        { minQty: 17, value: 5.0 },
        { minQty: 27, value: 6.5 },
      ],
      sortOrder: 30,
    },
    {
      key: "CONTENUTI",
      label: "Contenuti (TIMVision)",
      // NB: un TIMVision L include 3 OTT (Netflix, Prime Video, Disney+) e conta
      // 3 pezzi sulla gara — vedi saleWeight in engine.ts.
      category: "Contenuti",
      unit: "EUR_PER_PIECE",
      hasTiers: true,
      target: 22,
      pxqEur: 0,
      rules:
        "Gettone a soglia (soglia 3 = 24 pezzi → 10€). Serve ≥75% attivo/registrato, altrimenti premio al 50%. Prime NON prende il gettone (solo PxQ 3€). " +
        "QTY PESATA — ora nel motore (saleWeight): TIMVision L conta 3 pezzi perché include 3 OTT (Netflix, Prime Video, Disney+), Dazn completo ×3, MyClub ×2. Una sola vendita, più pezzi su soglia e gettone.",
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
      status: "ATTIVA",
      statusNote: "In vendita: primi finanziamenti il 22 e 24/07",
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
      target: 15,
      pxqEur: 0,
      status: "ATTIVA",
      statusNote: "In vendita: 6 pezzi a luglio (1 il 17, 2 il 22, 3 il 28)",
      rules:
        "DUE COMPONENTI CHE SI SOMMANO (documento 30/07). PxQ: Family 20 € + Assistenza Stradale Europa 5 € = 25 € a pezzo, sempre, dal primo — Lorenzo vende sempre l'abbinata. " +
        "Gara volume sul Family primario: al raggiungimento della soglia si aggiunge un gettone su TUTTI i pezzi del mese, +10 € da 8 pezzi e +20 € da 15. " +
        "Quindi il valore pieno è 25 € sotto gli 8, 35 € da 8, 45 € da 15. TWIN vale 10 € in più, come extra separato. " +
        "Gli 8 pezzi sono anche un CANCELLO del Top Club, che senza di essi si azzera.",
      // I tier sono il valore COMPLESSIVO a pezzo (PxQ + gettone volume).
      tiers: [
        { minQty: 0, value: 25 },
        { minQty: 8, value: 35 },
        { minQty: 15, value: 45 },
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
        "Punteggi lettera (per il calcolo live uso quelli deducibili dalle vendite; gli altri servono a mano dal consuntivo): Acc.netto FWA Ric 4 · SMB Fix 4 · TIM FIN 4 · Telepass 4 · Trasf. da prop. 3 · MNVO ICP 3 · MNP No ICP 2 · MNP KENA 2 · MNP Val 1,5 · AL PP net 0,5. " +
        "Due precisazioni recepite dal consuntivo TIM: (1) la riga Accessi premia SOLO le FWA ricaricabile (vendite ACCESSO_FISSO con subtype FWA_RIC) — gli accessi in fibra piena non portano quei 4 pt; (2) ogni MNP pesa DUE volte, 2 pt sulla riga 'No ICP' + 1,5 pt sulla riga 'Val', quindi 3,5 pt a pezzo.",
      gates: [
        { lineKey: "ACCESSO_FISSO", minQty: 17 },
        { lineKey: "MNP", minQty: 37 },
        { lineKey: "TELEPASS_FAMILY", minQty: 8 },
      ],
      // Le 10 righe della lettera, verificate il 29/07 su "Incentivazione TIM.docx"
      // (divisione definitiva) e sulla lettera TIM Fisso/Mobile Luglio 2026.
      // ⚠️ "Accessi Consumer (netto FWA Ricaricabile)": la lettera dice
      // «Non saranno conteggiate le acquisizioni con offerta FWA Ricaricabile»,
      // quindi il punto va agli accessi A CANONE. Fino al 29/07 qui c'era
      // matchSubtype FWA_RIC, che contava esattamente il contrario.
      scoreKpis: [
        // Accessi Consumer a canone: scarta i tre sottotipi che hanno righe proprie.
        { key: "ACCESSO_FISSO", label: "Accessi Consumer a canone", points: 4, source: "DERIVED", excludeSubtypeIn: ["FWA_RIC", "SMB", "TRASFORMAZIONE", "TRASFORMAZIONE_FWA"], sortOrder: 10 },
        { key: "SMB_FIX", label: "Accessi SMB", points: 4, source: "DERIVED", sourceLineKey: "ACCESSO_FISSO", matchSubtype: "SMB", sortOrder: 15 },
        { key: "TIMFIN", label: "TIM Fin", points: 4, source: "DERIVED", sortOrder: 20 },
        { key: "TELEPASS_FAMILY", label: "Telepass", points: 4, source: "DERIVED", sortOrder: 30 },
        { key: "TRASFORMAZIONE", label: "Trasf. Fibra da proponi", points: 3, source: "DERIVED", sourceLineKey: "ACCESSO_FISSO", matchSubtype: "TRASFORMAZIONE", sortOrder: 35 },
        // le MNP si dividono per provenienza: da MVNO valgono 3, le altre 2 (non si sommano)
        { key: "MNP_MVNO", label: "MNP MVNO (Iliad/Coop/Poste)", points: 3, source: "DERIVED", sourceLineKey: "MNP", provenanceIn: ["ILIAD", "COOP", "POSTE"], sortOrder: 38 },
        { key: "MNP", label: "MNP (netto MVNO)", points: 2, source: "DERIVED", provenanceNotIn: ["ILIAD", "COOP", "POSTE", "KENA"], sortOrder: 40 },
        // riga ADDIZIONALE sulla stessa pista MNP, ma solo col canone da 9,99 in su
        { key: "MNP_VAL", label: "MNP Val (canone ≥ 9,99)", points: 1.5, source: "DERIVED", sourceLineKey: "MNP", minFeeEur: 9.99, sortOrder: 45 },
        { key: "MNP_KENA", label: "MNP Kena", points: 2, source: "DERIVED", sourceLineKey: "MNP", provenanceIn: ["KENA"], sortOrder: 48 },
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
        "Premio A SCALINO: 200 pt → 200€, 450 pt → 1.500€. Nessun valore intermedio. Soglia minima 8 Prop. Mobile/mese (cambio offerta + add-on dati ricorsivi): sotto gli 8 il premio NON si prende affatto (confermato da Lorenzo il 30/07: è un requisito, non un dimezzamento). KPI da consuntivo TIM (M+1), inseriti a mano.",
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
      // factor 0 = requisito secco, non dimezzamento: sotto 8 Prop. Mobile il premio è ZERO.
      halvings: [{ inputKey: "cb.upsellingVolume", minValue: 8, factor: 0, label: "Prop. Mobile < 8 → premio azzerato" }],
    },
  ],
  params: [
    { key: "billSize", valueJson: { full: 9, half: 8 } },
    // La penalità scatta "sotto la soglia 2 delle AL": il documento definitivo
    // fissa quella soglia a 15 (prima qui c'era 16, preso dall'avanzamento di Mirko).
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
  label: "Fastweb — via mandato C.Net",
  status: "ACTIVE",
  engineVersion: "linear",
  notes:
    "Compensi CONFERMATI da Lorenzo il 25/07: Casa Pro 180 · Mobile Ultra 136 · Mobile Start 86 · Business Freedom 112. Il compenso vero sta sull'OFFERTA (listino, compensoEur): il valore di pista è solo il default per vendite senza offerta.",
  lines: [
    { key: "MOBILE", label: "Fastweb Mobile", category: "Mobile", unit: "EUR_PER_PIECE", hasTiers: false, rules: "Il compenso cambia per offerta: Ultra 136 €, Start 86 € (confermati 25/07). Default di pista 86 — assegna sempre l'offerta alla vendita.", tiers: [{ minQty: 0, value: 86 }], sortOrder: 10 },
    { key: "TEL_INC", label: "Fastweb Telefono incluso", category: "Rate", unit: "EUR_PER_PIECE", hasTiers: false, rules: "Pista monitorata, senza target.", tiers: [{ minQty: 0, value: 48 }], sortOrder: 20 },
    { key: "FISSO", label: "Fastweb Fisso", category: "Fisso", unit: "EUR_PER_PIECE", hasTiers: false, rules: "Casa Pro 180 € confermato 25/07.", tiers: [{ minQty: 0, value: 180 }], sortOrder: 30 },
    { key: "ENERGIA", label: "Fastweb Energia (luce o gas)", category: "Energia", unit: "EUR_PER_PIECE", hasTiers: false, rules: "100 € a contratto (indicazione Lorenzo). Da confermare col piano 2026.", tiers: [{ minQty: 0, value: 100 }], sortOrder: 40 },
    { key: "FISSO_BUSINESS", label: "Fastweb Fisso business", category: "Fisso", unit: "MULTIPLIER_ON_FEE", hasTiers: false, rules: "5 × canone (stima, in attesa di conferma come per il mobile business).", tiers: [{ minQty: 0, value: 5 }], sortOrder: 50 },
    { key: "MOBILE_BUSINESS", label: "Fastweb Mobile business", category: "Mobile", unit: "EUR_PER_PIECE", hasTiers: false, rules: "Business Freedom 112 € a SIM, confermato 25/07 (prima era stimato 5 × canone).", tiers: [{ minQty: 0, value: 112 }], sortOrder: 60 },
    { key: "ENERGIA_BUSINESS", label: "Fastweb Energia business", category: "Energia", unit: "EUR_PER_PIECE", hasTiers: false, rules: "⚠️ Compenso da confermare.", tiers: [{ minQty: 0, value: 0 }], sortOrder: 70 },
  ],
  prizes: [],
  params: [],
};

// Il compenso Enel dipende da come arriva il contratto, non da cosa contiene:
// luce e gas valgono uguale, ma inserirli insieme li paga di più. Due piste
// separate perché è la scelta che fai al momento della registrazione; il dual
// si registra come due vendite su ENERGIA_DUAL (90 € l'una, 180 € il cliente).
const ENEL = linear(
  "ENEL",
  "Enel — Energia",
  [
    { key: "ENERGIA", label: "Enel Energia singola (luce o gas)", category: "Energia", eur: 70, sortOrder: 10, note: "70 € a contratto singolo, indifferentemente luce o gas (cifre confermate da Lorenzo il 25/07)." },
    { key: "ENERGIA_DUAL", label: "Enel Energia dual (luce + gas)", category: "Energia", eur: 90, sortOrder: 20, note: "90 € A CONTRATTO quando luce e gas entrano contestualmente: un dual completo vale 180 €. Registra due vendite, una per contratto." },
  ],
  "Compensi confermati da Lorenzo il 25/07: 70 € il contratto singolo, 90 € a contratto se il dual è contestuale.",
);

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
