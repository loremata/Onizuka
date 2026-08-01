/**
 * QUALI DATI SERVONO PERCHÉ IL COMPENSO SIA VERO.
 *
 * Regola UNICA, usata in due momenti: dal form al momento di salvare (rifiuta)
 * e dal cruscotto sulle righe già a sistema (segnala). Se fossero due regole
 * separate finirebbero per divergere, e il sistema direbbe una cosa quando
 * salvi e un'altra quando guardi il totale.
 *
 * Il principio: un sistema che calcola soldi non deve accettare un dato
 * ambiguo e avvisare dopo. Se senza quel campo il numero è sbagliato, il campo
 * è obbligatorio — al momento in cui lo si può ancora chiedere al cliente.
 */

import { isAccessoSenzaCanone } from "./accesso-subtypes";

export type SaleFacts = {
  lineKey: string;
  /** EUR_PER_PIECE | MULTIPLIER_ON_FEE */
  lineUnit: string;
  subtype?: string | null;
  offerCode?: string | null;
  feeEur?: number | null;
  provenance?: string | null;
  /**
   * Compensi distinti a listino per QUESTA pista (non per il brand: confrontare
   * un fisso con le offerte mobile darebbe un'ambiguità che non esiste).
   */
  offerPricesForLine: number[];
};

export type MissingSaleData = {
  field: "offerCode" | "feeEur" | "provenance";
  /** Messaggio per il banco: dice cosa manca e PERCHÉ serve. */
  message: string;
  /** true = senza questo il compenso calcolato è diverso da quello vero. */
  affectsMoney: boolean;
};

/**
 * FWA ricaricabile: pagata a gettone, un canone mensile non ce l'ha. Chiederlo
 * sarebbe un falso allarme, e i falsi allarmi insegnano a ignorarli tutti.
 */
function isGettoneFwa(f: SaleFacts): boolean {
  // Estesa il 01/08: oltre all'FWA ricaricabile ci sono le linee PMI e le
  // trasformazioni fibra, che per lettera contano per la soglia ma non
  // prendono il gettone. Nessuna delle tre ha un canone da chiedere.
  return isAccessoSenzaCanone(f.lineKey, f.subtype);
}

/** Il primo dato mancante che rende falso il compenso, o null se la riga è completa. */
export function missingRequiredSaleData(f: SaleFacts): MissingSaleData | null {
  // 1) Compenso = canone × moltiplicatore: senza canone la vendita vale zero.
  if (f.lineUnit === "MULTIPLIER_ON_FEE" && f.feeEur == null && !isGettoneFwa(f)) {
    return {
      field: "feeEur",
      message:
        "Inserisci il canone: su questa pista il compenso si calcola moltiplicando il canone del cliente.",
      affectsMoney: true,
    };
  }

  // 2) Gettone che cambia da offerta a offerta (Fastweb): senza l'offerta si
  //    applica il valore di default della pista e il totale mente in silenzio.
  const distinct = Array.from(new Set(f.offerPricesForLine));
  if (f.lineUnit === "EUR_PER_PIECE" && !f.offerCode && distinct.length > 1) {
    const min = Math.min(...distinct);
    const max = Math.max(...distinct);
    return {
      field: "offerCode",
      message: `Scegli l'offerta: su questa pista il compenso cambia da offerta a offerta (da ${min} a ${max} €).`,
      affectsMoney: true,
    };
  }

  // 3) Provenienza MNP: non cambia il compenso della singola vendita ma serve
  //    alle gare, e dopo qualche giorno nessuno ricorda da chi arrivava il numero.
  if (f.lineKey === "MNP" && !f.provenance) {
    return {
      field: "provenance",
      message: "Indica da quale operatore arriva il numero: serve alle gare MNP.",
      affectsMoney: false,
    };
  }

  return null;
}
