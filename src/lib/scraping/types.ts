// Tipi condivisi della pipeline di scraping.

export type StatoImpresa = "attiva" | "cessata" | "in liquidazione" | "inattiva" | "sconosciuto";

// Record grezzo dal registro (registroaziende.it).
export interface RegistroItem {
  nome: string;
  ragioneSociale: string;
  partitaIva: string;
  stato: StatoImpresa;
  statoRaw: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  atecoCodice: string;
  atecoDescrizione: string;
  atecoDivisione: string;
  dipendenti: string;
  urlScheda: string;
}

// Record grezzo da Google Places.
export interface PlaceItem {
  placeId: string;
  nome: string;
  indirizzo: string;
  telefono: string;
  sitoWeb: string;
  categoria: string;
  rating: number | "";
  nRecensioni: number;
  businessStatus: string;
  citta: string;
  lat: number | "";
  lng: number | "";
  mapsUrl: string;
}

// Azienda risolta (dopo dedup/merge registro↔Places): 1 record = 1 azienda reale.
export interface ResolvedCompany {
  nome: string; // ragione sociale se disponibile, altrimenti nome vetrina
  nomeVetrina: string; // nome da Google (se diverso)
  partitaIva: string;
  stato: StatoImpresa;
  attiva: boolean;
  indirizzo: string;
  citta: string;
  telefono: string;
  sitoWeb: string;
  dominioSito: string;
  categoria: string;
  ateco: string;
  dipendenti: string;
  rating: number | "";
  nRecensioni: number | "";
  googlePlaceId: string;
  mapsUrl: string;
  fonti: string[]; // ["registro"], ["places"], ["registro","places"]
}

// Callback di progresso verso il ScrapeJob.
export type ProgressFn = (p: {
  phase: string;
  current?: number;
  total?: number;
  note?: string;
}) => Promise<void> | void;
