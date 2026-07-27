/**
 * AVANZAMENTO UFFICIALE della gara — il registro di quello che il gestore
 * (TIM) dichiara di riconoscere, mese per mese, alla data che comunica.
 *
 * Perché esiste: quello che registriamo al banco (`StoreSale`) e quello che TIM
 * riconosce NON coincidono quasi mai. Al 25/07/2026, per dire, il banco aveva
 * 11 MNP e TIM ne contava 6; il banco 3 accessi FWA ric e TIM 5. Quel delta è
 * la cosa più preziosa del mese: portabilità ancora in corso, pratiche scartate,
 * pratiche mai caricate — cioè soldi che rischi di lasciare per strada.
 *
 * Questo file NON tocca il motore dei compensi: legge le vendite direttamente e
 * le mette a confronto con l'avanzamento dichiarato. Due numeri, entrambi veri,
 * mai fusi insieme.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, type StoreBrand } from "@prisma/client";

/** Sottotipo delle vendite Fisso che nella gara pesa 0,5 invece di 1. */
const FWA_RIC = "FWA_RIC";

/** Piste su cui il gestore comunica l'avanzamento, nell'ordine della lettera. */
export const OFFICIAL_LINES = [
  {
    key: "MNP",
    label: "Mobile MNP",
    /** Ha senso chiedere "di cui domiciliate"? */
    domiciled: true,
    /** Si deduce dalle vendite del banco? (i punteggi no) */
    fromSales: true,
  },
  { key: "AL_PP", label: "Mobile AL PP nette", domiciled: true, fromSales: true },
  { key: "ACCESSO_FISSO", label: "Accessi Fisso", domiciled: true, fromSales: true },
  { key: "CONTENUTI", label: "Contenuti (TIMVision)", domiciled: false, fromSales: true },
  { key: "ENERGIA", label: "TIM Energia", domiciled: false, fromSales: true },
  { key: "TIMFIN", label: "TIMFin", domiciled: false, fromSales: true },
  { key: "TELEPASS_FAMILY", label: "Telepass Family", domiciled: false, fromSales: true },
  { key: "TIM_UNICA", label: "TIM Unica", domiciled: false, fromSales: true },
  { key: "TOP_CLUB", label: "Top Club (punteggio)", domiciled: false, fromSales: false },
  { key: "CUSTOMER_BASE", label: "Customer Base (punteggio)", domiciled: false, fromSales: false },
] as const;

export type OfficialLineKey = (typeof OFFICIAL_LINES)[number]["key"];

const LINE_ORDER = new Map(OFFICIAL_LINES.map((l, i) => [l.key as string, i]));
const LINE_LABEL = new Map(OFFICIAL_LINES.map((l) => [l.key as string, l.label as string]));
const LINE_FROM_SALES = new Map(OFFICIAL_LINES.map((l) => [l.key as string, l.fromSales as boolean]));

/** Etichetta leggibile di una pista, anche se non è fra quelle note. */
export function officialLineLabel(lineKey: string): string {
  return LINE_LABEL.get(lineKey) ?? lineKey;
}

// ---------------------------------------------------------------- utilità

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "YYYY-MM-DD" da una data (o da una stringa già nel formato giusto). */
export function toDateKey(d: Date | string): string {
  if (typeof d === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Data non valida: "${d}". Attesa nel formato AAAA-MM-GG.`);
    return d;
  }
  return d.toISOString().slice(0, 10);
}

/** Mezzanotte UTC: le colonne `@db.Date` vanno scritte così in tutto il modulo. */
function toUtcDate(d: Date | string): Date {
  return new Date(`${toDateKey(d)}T00:00:00.000Z`);
}

function assertMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Mese non valido: "${month}". Atteso nel formato AAAA-MM.`);
}

/** "25/07/2026" da "2026-07-25". */
export function itDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

// ------------------------------------------------------------ lettura

export type OfficialLineValue = {
  lineKey: string;
  /** Quantità o punteggio riconosciuto dal gestore (può essere decimale: 6,5). */
  qty: number;
  domiciledQty: number | null;
  breakdown: string | null;
  notes: string | null;
  /** Data dell'avanzamento a cui questa riga appartiene ("YYYY-MM-DD"). */
  asOfDate: string;
};

export type OfficialProgressSnapshot = {
  month: string;
  brand: StoreBrand;
  /** Data dell'avanzamento più recente del mese; null se non ne è stato inserito nessuno. */
  asOfDate: string | null;
  /** Mappa pista → valori riconosciuti. Vuota se non c'è avanzamento. */
  byLine: Record<string, OfficialLineValue>;
};

/**
 * L'avanzamento PIÙ RECENTE del mese: si prende l'`asOfDate` massimo e si
 * restituiscono tutte le righe di quella data. Gli avanzamenti precedenti
 * restano in archivio (vedi `listOfficialProgressDates`).
 */
export async function getOfficialProgress({
  ownerUserId,
  brand = "TIM",
  month,
}: {
  ownerUserId: string;
  brand?: StoreBrand;
  month: string;
}): Promise<OfficialProgressSnapshot> {
  assertMonth(month);

  const latest = await prisma.incentiveOfficialProgress.findFirst({
    where: { ownerUserId, brand, month },
    orderBy: { asOfDate: "desc" },
    select: { asOfDate: true },
  });

  if (!latest) return { month, brand, asOfDate: null, byLine: {} };

  const rows = await prisma.incentiveOfficialProgress.findMany({
    where: { ownerUserId, brand, month, asOfDate: latest.asOfDate },
  });

  const asOfDate = toDateKey(latest.asOfDate);
  const byLine: Record<string, OfficialLineValue> = {};
  for (const r of rows) {
    byLine[r.lineKey] = {
      lineKey: r.lineKey,
      qty: round2(Number(r.qty)),
      domiciledQty: r.domiciledQty,
      breakdown: r.breakdown,
      notes: r.notes,
      asOfDate,
    };
  }

  return { month, brand, asOfDate, byLine };
}

/**
 * Le date di avanzamento disponibili per il mese, dalla più recente alla più
 * vecchia: è lo storico ("com'era il 10, com'è il 25").
 */
export async function listOfficialProgressDates({
  ownerUserId,
  brand = "TIM",
  month,
}: {
  ownerUserId: string;
  brand?: StoreBrand;
  month: string;
}): Promise<string[]> {
  assertMonth(month);
  const rows = await prisma.incentiveOfficialProgress.groupBy({
    by: ["asOfDate"],
    where: { ownerUserId, brand, month },
    orderBy: { asOfDate: "desc" },
  });
  return rows.map((r) => toDateKey(r.asOfDate));
}

/** L'avanzamento di UNA data precisa (per rileggere/correggere lo storico). */
export async function getOfficialProgressAt({
  ownerUserId,
  brand = "TIM",
  month,
  asOfDate,
}: {
  ownerUserId: string;
  brand?: StoreBrand;
  month: string;
  asOfDate: Date | string;
}): Promise<OfficialProgressSnapshot> {
  assertMonth(month);
  const dateKey = toDateKey(asOfDate);
  const rows = await prisma.incentiveOfficialProgress.findMany({
    where: { ownerUserId, brand, month, asOfDate: toUtcDate(dateKey) },
  });
  const byLine: Record<string, OfficialLineValue> = {};
  for (const r of rows) {
    byLine[r.lineKey] = {
      lineKey: r.lineKey,
      qty: round2(Number(r.qty)),
      domiciledQty: r.domiciledQty,
      breakdown: r.breakdown,
      notes: r.notes,
      asOfDate: dateKey,
    };
  }
  return { month, brand, asOfDate: rows.length ? dateKey : null, byLine };
}

// ------------------------------------------------------------ scrittura

export type OfficialProgressInputRow = {
  lineKey: string;
  /** Quantità/punteggio riconosciuto. `null` elimina la riga per quella data. */
  qty: number | null;
  domiciledQty?: number | null;
  breakdown?: string | null;
  notes?: string | null;
};

/**
 * Inserisce o aggiorna l'avanzamento di una data. Idempotente sull'unique
 * (owner + brand + mese + data + pista): rilanciarlo con gli stessi numeri non
 * crea duplicati, rilanciarlo con numeri diversi corregge la riga.
 *
 * Pensata anche per essere chiamata da uno script `tsx` di caricamento.
 */
export async function upsertOfficialProgress({
  ownerUserId,
  brand = "TIM",
  month,
  asOfDate,
  rows,
}: {
  ownerUserId: string;
  brand?: StoreBrand;
  month: string;
  asOfDate: Date | string;
  rows: OfficialProgressInputRow[];
}): Promise<{ asOfDate: string; saved: number; removed: number }> {
  assertMonth(month);
  if (!ownerUserId) throw new Error("Manca l'utente proprietario dell'avanzamento.");
  const dateKey = toDateKey(asOfDate);
  if (dateKey.slice(0, 7) !== month) {
    throw new Error(`La data ${itDate(dateKey)} non appartiene al mese ${month}.`);
  }
  const date = toUtcDate(dateKey);

  let saved = 0;
  let removed = 0;

  for (const row of rows) {
    const lineKey = row.lineKey.trim();
    if (!lineKey) continue;

    const where = {
      ownerUserId_brand_month_asOfDate_lineKey: { ownerUserId, brand, month, asOfDate: date, lineKey },
    };

    // qty vuota = la pista non è (più) nell'avanzamento di quella data
    if (row.qty == null) {
      const res = await prisma.incentiveOfficialProgress.deleteMany({
        where: { ownerUserId, brand, month, asOfDate: date, lineKey },
      });
      removed += res.count;
      continue;
    }

    if (!Number.isFinite(row.qty) || row.qty < 0) {
      throw new Error(`Quantità non valida per ${officialLineLabel(lineKey)}: "${row.qty}".`);
    }
    const domRaw = row.domiciledQty == null ? null : Math.round(Number(row.domiciledQty));
    const domiciledQty = domRaw == null || !Number.isFinite(domRaw) ? null : Math.max(0, domRaw);
    const breakdown = row.breakdown?.trim() || null;
    const notes = row.notes?.trim() || null;
    const qty = new Prisma.Decimal(round2(row.qty));

    await prisma.incentiveOfficialProgress.upsert({
      where,
      update: { qty, domiciledQty, breakdown, notes },
      create: { ownerUserId, brand, month, asOfDate: date, lineKey, qty, domiciledQty, breakdown, notes },
    });
    saved += 1;
  }

  return { asOfDate: dateKey, saved, removed };
}

/** Cancella l'intero avanzamento di una data (serve a rifare un caricamento sbagliato). */
export async function deleteOfficialProgress({
  ownerUserId,
  brand = "TIM",
  month,
  asOfDate,
}: {
  ownerUserId: string;
  brand?: StoreBrand;
  month: string;
  asOfDate: Date | string;
}): Promise<number> {
  assertMonth(month);
  const res = await prisma.incentiveOfficialProgress.deleteMany({
    where: { ownerUserId, brand, month, asOfDate: toUtcDate(asOfDate) },
  });
  return res.count;
}

// ------------------------------------------------------------ confronto

/** Che tipo di scostamento è. Guida colore e priorità nella UI. */
export type OfficialDeltaStatus =
  /** i due numeri coincidono */
  | "OK"
  /** ho registrato più di quello che TIM riconosce → attivazioni da inseguire */
  | "DA_INSEGUIRE"
  /** TIM riconosce più di quello che ho registrato → vendite da registrare */
  | "DA_REGISTRARE"
  /** la pista non compare nell'avanzamento comunicato */
  | "NON_COMUNICATO"
  /** punteggio comunicato da TIM: non si deduce dalle vendite del banco */
  | "SOLO_UFFICIALE";

export type CompareRow = {
  lineKey: string;
  label: string;
  /** Pezzi registrati al banco nel mese. null = pista non deducibile dalle vendite. */
  registered: number | null;
  /** Di cui domiciliate (dalle vendite). */
  registeredDomiciled: number;
  /** Solo ACCESSO_FISSO: quante delle registrate sono FWA ricaricabili (peso 0,5 in gara). */
  registeredFwaRic: number | null;
  /** Solo ACCESSO_FISSO: le stesse vendite pesate come le pesa la gara. */
  registeredWeighted: number | null;
  /** Quantità/punteggio riconosciuto da TIM. null = non comunicato. */
  official: number | null;
  officialDomiciled: number | null;
  breakdown: string | null;
  /** registered − official. null quando uno dei due manca. */
  delta: number | null;
  status: OfficialDeltaStatus;
  /** Frase pronta da mostrare, in italiano. */
  hint: string;
};

export type CompareResult = {
  month: string;
  brand: StoreBrand;
  /** Data dell'avanzamento usato per il confronto; null se non ce n'è nessuno. */
  asOfDate: string | null;
  hasOfficial: boolean;
  rows: CompareRow[];
  /** Quanti pezzi ho registrato in più di quelli riconosciuti (totale da inseguire). */
  totalToChase: number;
  /** Quanti pezzi TIM riconosce e io non ho a registro (totale da registrare). */
  totalToRecord: number;
};

const plural = (n: number, uno: string, molti: string) => (n === 1 ? uno : molti);
const q = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });

function buildHint(registered: number | null, official: number | null, delta: number | null): {
  status: OfficialDeltaStatus;
  hint: string;
} {
  if (official == null) {
    if (registered && registered > 0) {
      return {
        status: "NON_COMUNICATO",
        hint: "Non compare nell'avanzamento TIM: potrebbe arrivare al prossimo aggiornamento.",
      };
    }
    return { status: "NON_COMUNICATO", hint: "Nessun dato: né vendite registrate né avanzamento comunicato." };
  }

  if (registered == null) {
    return {
      status: "SOLO_UFFICIALE",
      hint: "Punteggio comunicato da TIM: non si ricava dalle vendite del banco.",
    };
  }

  if (delta === 0) return { status: "OK", hint: "Tutto quadra: TIM riconosce quello che hai registrato." };

  if ((delta ?? 0) > 0) {
    const n = round2(delta ?? 0);
    return {
      status: "DA_INSEGUIRE",
      hint: `${q(n)} ${plural(n, "attivazione non ancora riconosciuta", "attivazioni non ancora riconosciute")}: verifica portabilità/scarti.`,
    };
  }

  const n = round2(Math.abs(delta ?? 0));
  return {
    status: "DA_REGISTRARE",
    hint: `TIM ne riconosce ${q(n)} in più: ${plural(n, "vendita non registrata", "vendite non registrate")} a Onizuka.`,
  };
}

/**
 * Il confronto pista per pista: quello che ho registrato io e quello che TIM
 * riconosce, con lo scostamento e cosa farci.
 *
 * Legge le vendite DIRETTAMENTE (groupBy sulle StoreSale), senza passare dal
 * motore dei compensi: qui conta il pezzo, non l'euro.
 */
export async function compareOfficialVsRegistered({
  ownerUserId,
  brand = "TIM",
  month,
}: {
  ownerUserId: string;
  brand?: StoreBrand;
  month: string;
}): Promise<CompareResult> {
  assertMonth(month);

  // L'avanzamento è una FOTO a una data: per un confronto onesto si contano solo
  // le vendite fino a quel giorno, altrimenti quelle fatte dopo sembrerebbero
  // "non riconosciute" mentre TIM semplicemente non le aveva ancora viste.
  const official = await getOfficialProgress({ ownerUserId, brand, month });
  const upTo = official.asOfDate ? new Date(`${official.asOfDate}T23:59:59.999Z`) : null;
  const saleWhere = { ownerUserId, brand, month, ...(upTo ? { date: { lte: upTo } } : {}) };

  const [byLine, byLineDomiciled, fwaRic] = await Promise.all([
    prisma.storeSale.groupBy({
      by: ["lineKey"],
      where: saleWhere,
      _count: { _all: true },
    }),
    prisma.storeSale.groupBy({
      by: ["lineKey"],
      where: { ...saleWhere, domiciled: true },
      _count: { _all: true },
    }),
    prisma.storeSale.count({
      where: { ...saleWhere, lineKey: "ACCESSO_FISSO", subtype: FWA_RIC },
    }),
  ]);

  const regCount = new Map(byLine.map((r) => [r.lineKey, r._count._all]));
  const regDom = new Map(byLineDomiciled.map((r) => [r.lineKey, r._count._all]));

  // tutte le piste da mostrare: quelle note + eventuali extra (vendite fuori
  // elenco o piste comunicate da TIM che ancora non conosciamo)
  const keys = new Set<string>(OFFICIAL_LINES.map((l) => l.key as string));
  regCount.forEach((_v, k) => keys.add(k));
  for (const k of Object.keys(official.byLine)) keys.add(k);

  const ordered = Array.from(keys).sort((a, b) => {
    const ia = LINE_ORDER.get(a) ?? 999;
    const ib = LINE_ORDER.get(b) ?? 999;
    return ia !== ib ? ia - ib : a.localeCompare(b, "it");
  });

  const rows: CompareRow[] = ordered.map((lineKey) => {
    const known = LINE_FROM_SALES.get(lineKey);
    const sold = regCount.get(lineKey) ?? 0;
    // piste a punteggio (Top Club, Customer Base): dal banco non si contano
    const registered = known === false ? null : sold;
    const off = official.byLine[lineKey];
    const officialQty = off ? off.qty : null;

    const isFisso = lineKey === "ACCESSO_FISSO";
    // Il Fisso si confronta a PUNTI, non a pezzi: TIM comunica 6,5 perché una FWA
    // ricaricabile pesa mezzo punto. Sulle altre piste pezzi e punti coincidono.
    const weighted = isFisso ? round2(sold - fwaRic * 0.5) : null;
    const registeredForDelta = isFisso ? weighted : registered;
    const delta =
      registeredForDelta != null && officialQty != null ? round2(registeredForDelta - officialQty) : null;
    const { status, hint } = buildHint(registeredForDelta, officialQty, delta);

    return {
      lineKey,
      label: officialLineLabel(lineKey),
      registered,
      registeredDomiciled: regDom.get(lineKey) ?? 0,
      registeredFwaRic: isFisso ? fwaRic : null,
      registeredWeighted: weighted,
      official: officialQty,
      officialDomiciled: off?.domiciledQty ?? null,
      breakdown: off?.breakdown ?? null,
      delta,
      status,
      hint,
    };
  });

  const totalToChase = round2(rows.reduce((a, r) => a + (r.delta && r.delta > 0 ? r.delta : 0), 0));
  const totalToRecord = round2(rows.reduce((a, r) => a + (r.delta && r.delta < 0 ? -r.delta : 0), 0));

  return {
    month,
    brand,
    asOfDate: official.asOfDate,
    hasOfficial: official.asOfDate != null,
    rows,
    totalToChase,
    totalToRecord,
  };
}
