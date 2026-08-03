/**
 * Sottotipi della pista Accessi Fisso — UNICA definizione, la usano motore,
 * form di registrazione e punteggi dei premi.
 *
 * La lettera TIM di luglio 2026 distingue tre casi che contano per la soglia
 * della Gara Fisso ma NON prendono il gettone di gara:
 *
 *  - FWA Ricaricabile: «Non saranno conteggiate le acquisizioni con offerta FWA
 *    Ricaricabile» ai fini del Top Club, e pesa 0,5 sulla soglia.
 *  - Trasformazioni fibra da proponi: «ai soli fini del raggiungimento della
 *    soglia, saranno contate le Trasformazioni da RTG/ADSL verso Fibra
 *    FTTC/FTTH […] ma non saranno compensate con il gettone di gara».
 *  - Linee PMI fisso (SMB): «concorreranno soltanto al raggiungimento della
 *    soglia ma non saranno compensate con il gettone di gara».
 *
 * Nessuno dei tre ha un canone, quindi il compenso viene già zero da sé: il
 * motore moltiplica il canone per il moltiplicatore, e senza canone non c'è
 * niente da moltiplicare. Quello che serviva era registrarli senza che il
 * controllo sul canone li rifiutasse all'ingresso, e tenerli separati nei
 * punteggi del Top Club, dove ognuno ha la sua riga.
 */

export const ACCESSO_SUBTYPES = {
  FWA_RIC: {
    label: "FWA ricaricabile",
    hint: "niente canone · pesa 0,5 sulla soglia · nessun punto Top Club",
    weight: 0.5,
  },
  SMB: {
    label: "Linea PMI fisso (SMB)",
    hint: "niente gettone di gara · conta per la soglia · 4 punti Top Club",
    weight: 1,
  },
  TRASFORMAZIONE: {
    label: "Trasformazione fibra da proponi",
    hint: "da RTG/ADSL a FTTC/FTTH · 50 € di Gara Extra CB · 3 pt Top Club e 15 sul Customer Base",
    weight: 1,
  },
  TRASFORMAZIONE_FWA: {
    label: "Trasformazione FWA da proponi",
    hint: "50 € di Gara Extra CB · conta per la soglia, niente gettone di gara",
    weight: 1,
  },
} as const;

export type AccessoSubtype = keyof typeof ACCESSO_SUBTYPES;

/** I sottotipi di accesso che NON prendono il gettone di gara e quindi non
 *  hanno un canone da chiedere in registrazione. */
export const ACCESSI_SENZA_CANONE: AccessoSubtype[] = ["FWA_RIC", "SMB", "TRASFORMAZIONE", "TRASFORMAZIONE_FWA"];

/**
 * Ricava il sottotipo dall'offerta scelta a listino.
 *
 * Il tipo di accesso e l'offerta dicono la stessa cosa, e chiederli due volte
 * è una trappola: chi registra sceglie «FWA Ricaricabile pack» dal listino e
 * dà per scontato di aver detto tutto. Se il sottotipo resta vuoto la vendita
 * pesa un punto invece di mezzo sulla soglia Accessi, sballa i cancelli del
 * Top Club, e per giunta il canone del pack (99 €) finisce nel calcolo come
 * se fosse un abbonamento mensile. È successo il 3 agosto 2026.
 *
 * Quindi il sottotipo si deduce dall'offerta, e la scelta manuale resta solo
 * per i casi che il listino non descrive.
 */
export function subtypeDaOfferta(offerCode?: string | null): AccessoSubtype | null {
  if (!offerCode) return null;
  return offerCode.toUpperCase().includes("RICARICABILE") ? "FWA_RIC" : null;
}

export function isAccessoSenzaCanone(lineKey: string, subtype?: string | null): boolean {
  return lineKey === "ACCESSO_FISSO" && !!subtype && (ACCESSI_SENZA_CANONE as string[]).includes(subtype);
}
