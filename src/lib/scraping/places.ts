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
  "places.location", "places.googleMapsUri", "nextPageToken",
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
    citta: "",
    lat: p.location?.latitude ?? "",
    lng: p.location?.longitude ?? "",
    mapsUrl: p.googleMapsUri || "",
  };
}

// Interroga Places per un comune: categorie × comune, dedup su placeId, filtra all'area.
export async function scrapePlaces(
  apiKey: string,
  comune: string,
  provinciaSigla: string,
  onProgress?: ProgressFn
): Promise<PlaceItem[]> {
  const dedup = new Map<string, PlaceItem>();
  const comuneKey = comune.toLowerCase();
  let chiamate = 0;

  for (let i = 0; i < CATEGORIE.length; i++) {
    const query = `${CATEGORIE[i]} a ${comune} ${provinciaSigla}`;
    let token: string | undefined;
    let pagina = 0;
    do {
      try {
        const data = await searchText(apiKey, query, token);
        chiamate++;
        for (const p of data.places || []) {
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
    await onProgress?.({ phase: "places", current: i + 1, total: CATEGORIE.length, note: `${dedup.size} attività` });
  }

  // Tiene solo attività il cui indirizzo cita il comune target.
  const items = Array.from(dedup.values()).filter((x) => x.indirizzo.toLowerCase().includes(comuneKey));
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
