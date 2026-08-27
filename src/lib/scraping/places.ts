// Arricchimento via Google Places API (New) - Text Search.
// Usa fetch nativo: è l'API ufficiale di Google, nessun anti-bot.
import { sleep } from "./fetch";
import { normName, normAddrStreet, normPhone, siteDomain } from "./normalize";
import type { PlaceItem, ProgressFn } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress",
  "places.nationalPhoneNumber", "places.websiteUri", "places.rating",
  "places.userRatingCount", "places.businessStatus",
  "places.primaryTypeDisplayName", "places.types",
  "places.location", "places.googleMapsUri", "places.addressComponents", "nextPageToken",
].join(",");

// Categorie interrogate (target attività locali con presenza web).
export const CATEGORIE = [
  "ristorante", "pizzeria", "bar", "gelateria", "pasticceria",
  "hotel", "bed and breakfast", "agriturismo", "stabilimento balneare",
  "parrucchiere", "barbiere", "estetista", "centro benessere",
  "negozio abbigliamento", "negozio calzature", "gioielleria", "ottica",
  "ferramenta", "negozio arredamento", "fioraio", "tabaccheria",
  "supermercato", "panificio", "macelleria", "enoteca",
  "officina meccanica", "carrozzeria", "gommista", "autonoleggio",
  "idraulico", "elettricista", "imbianchino", "impresa edile", "falegnameria",
  "studio dentistico", "studio medico", "fisioterapista", "farmacia",
  "studio commercialista", "avvocato", "agenzia immobiliare", "agenzia assicurazioni",
  "palestra", "scuola guida", "lavanderia", "veterinario", "fotografo",
];

interface GPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
}

// Nome di località comparabile (accenti/punteggiatura via): serve a capire se un
// risultato sta davvero nel comune target.
function normLoc(s = ""): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Valore di un componente di indirizzo Google (es. "locality", "administrative_area_level_3").
function componente(p: GPlace, tipo: string): string {
  return p.addressComponents?.find((c) => c.types?.includes(tipo))?.longText?.trim() || "";
}

async function searchText(apiKey: string, textQuery: string, pageToken?: string) {
  const body: Record<string, unknown> = { textQuery, languageCode: "it", regionCode: "IT", maxResultCount: 20 };
  if (pageToken) body.pageToken = pageToken;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as { places?: GPlace[]; nextPageToken?: string };
}

function mapPlace(p: GPlace): PlaceItem {
  return {
    placeId: p.id || "",
    nome: p.displayName?.text || "",
    indirizzo: p.formattedAddress || "",
    telefono: p.nationalPhoneNumber || "",
    sitoWeb: p.websiteUri || "",
    categoria: p.primaryTypeDisplayName?.text || p.types?.[0] || "",
    rating: p.rating ?? "",
    nRecensioni: p.userRatingCount ?? 0,
    businessStatus: p.businessStatus || "",
    // Comune amministrativo (per il filtro) e località scritta (la frazione: è
    // l'informazione utile in vendita — "Rosignano Solvay" dice più di "Rosignano").
    comuneAmm:
      componente(p, "administrative_area_level_3") ||
      componente(p, "locality") ||
      componente(p, "postal_town"),
    citta: componente(p, "locality") || componente(p, "administrative_area_level_3"),
    lat: p.location?.latitude ?? "",
    lng: p.location?.longitude ?? "",
    mapsUrl: p.googleMapsUri || "",
  };
}

// Frazioni ri-interrogate nel secondo giro e tetto alle query extra: il secondo
// giro serve dove l'API tronca, non deve moltiplicare il costo delle chiamate.
const MAX_FRAZIONI = 4;
const MAX_QUERY_EXTRA = 60;

// Interroga Places per un comune: categorie × comune, dedup su placeId, filtra all'area.
// Due giri: (1) categoria × comune; (2) solo per le categorie "sature" (l'API taglia a
// 60 risultati) categoria × frazione, con le frazioni emerse dal primo giro — nei comuni
// grandi il grosso delle attività sta nelle frazioni.
export async function scrapePlaces(
  apiKey: string,
  comune: string,
  provinciaSigla: string,
  onProgress?: ProgressFn
): Promise<PlaceItem[]> {
  const dedup = new Map<string, PlaceItem>();
  const comuneKey = comune.toLowerCase();
  const target = normLoc(comune);
  let chiamate = 0;

  // Esegue una query paginata e dice se è rimasta "satura", cioè se ha restituito il
  // massimo che l'API concede (60 risultati = 3 pagine piene): oltre quel tetto Google
  // non pagina più e non manda nemmeno un token, quindi la saturazione si riconosce
  // dal numero di risultati, non da un nextPageToken residuo.
  const MAX_RISULTATI_QUERY = 60;
  const interroga = async (query: string): Promise<boolean> => {
    let token: string | undefined;
    let pagina = 0;
    let raccolti = 0;
    do {
      try {
        const data = await searchText(apiKey, query, token);
        chiamate++;
        for (const p of data.places || []) {
          raccolti++;
          const az = mapPlace(p);
          if (az.placeId && !dedup.has(az.placeId)) dedup.set(az.placeId, az);
        }
        token = data.nextPageToken;
        pagina++;
        if (token) await sleep(1800);
      } catch {
        token = undefined;
      }
    } while (token && pagina < 3);
    return Boolean(token) || raccolti >= MAX_RISULTATI_QUERY;
  };

  const sature: string[] = [];
  for (let i = 0; i < CATEGORIE.length; i++) {
    if (await interroga(`${CATEGORIE[i]} a ${comune} ${provinciaSigla}`)) sature.push(CATEGORIE[i]);
    await onProgress?.({ phase: "places", current: i + 1, total: CATEGORIE.length, note: `${dedup.size} attività` });
  }

  // Un risultato è nel comune target se lo dice il comune AMMINISTRATIVO di Google
  // (administrative_area_level_3), non il testo dell'indirizzo: nelle frazioni
  // l'indirizzo scrive la frazione ("Rosignano Solvay-Castiglioncello") e il vecchio
  // filtro per sottostringa buttava via proprio le zone più commerciali.
  // Il controllo sull'indirizzo resta come ripiego se Google non dà i componenti.
  const nelComune = (x: PlaceItem) =>
    (x.comuneAmm ? normLoc(x.comuneAmm) === target : false) ||
    (x.citta ? normLoc(x.citta) === target : false) ||
    (!x.comuneAmm && x.indirizzo.toLowerCase().includes(comuneKey));

  // Secondo giro mirato sulle frazioni più rappresentate (solo categorie sature).
  const frequenze = new Map<string, number>();
  for (const x of Array.from(dedup.values())) {
    if (!nelComune(x) || !x.citta || normLoc(x.citta) === target) continue;
    frequenze.set(x.citta, (frequenze.get(x.citta) ?? 0) + 1);
  }
  const frazioni = Array.from(frequenze.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FRAZIONI)
    .map(([nome]) => nome);

  if (sature.length && frazioni.length) {
    let extra = 0;
    for (const cat of sature) {
      for (const fr of frazioni) {
        if (extra >= MAX_QUERY_EXTRA) break;
        await interroga(`${cat} a ${fr} ${provinciaSigla}`);
        extra++;
      }
      if (extra >= MAX_QUERY_EXTRA) break;
      await onProgress?.({
        phase: "places",
        current: CATEGORIE.length,
        total: CATEGORIE.length,
        note: `${dedup.size} attività · frazioni: ${frazioni.join(", ")}`,
      });
    }
  }

  const items = Array.from(dedup.values()).filter(nelComune);
  await onProgress?.({
    phase: "places",
    current: CATEGORIE.length,
    total: CATEGORIE.length,
    note: `${items.length} attività nel comune · ${chiamate} chiamate API`,
  });
  return items;
}

// Chiavi derivate per il dedup.
export function placeKeys(p: PlaceItem) {
  return {
    nameKey: normName(p.nome),
    addrKey: normAddrStreet(p.indirizzo),
    phoneKey: normPhone(p.telefono),
    domainKey: siteDomain(p.sitoWeb),
  };
}
