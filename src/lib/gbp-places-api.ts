import { textContainsGbpUrl } from "@/lib/gbp-audit-signals";

export type GbpPlaceInsights = {
  placeName: string;
  rating: number | null;
  reviewCount: number | null;
  source: "places_api" | "none";
};

function placesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key || null;
}

function extractPlaceIdFromUrl(url: string): string | null {
  const cid = url.match(/[?&]cid=(\d+)/i)?.[1];
  if (cid) return null;
  const placeId = url.match(/place_id[=:]([A-Za-z0-9_-]+)/i)?.[1];
  return placeId ?? null;
}

async function fetchPlaceDetails(placeId: string, apiKey: string): Promise<GbpPlaceInsights | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,rating,user_ratings_total");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    result?: { name?: string; rating?: number; user_ratings_total?: number };
  };
  if (data.status !== "OK" || !data.result) return null;

  return {
    placeName: data.result.name ?? "Google Business",
    rating: typeof data.result.rating === "number" ? data.result.rating : null,
    reviewCount:
      typeof data.result.user_ratings_total === "number" ? data.result.user_ratings_total : null,
    source: "places_api",
  };
}

async function findPlaceFromText(query: string, apiKey: string): Promise<GbpPlaceInsights | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  url.searchParams.set("input", query);
  url.searchParams.set("inputtype", "textquery");
  url.searchParams.set("fields", "place_id,name,rating,user_ratings_total");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    candidates?: { place_id?: string; name?: string; rating?: number; user_ratings_total?: number }[];
  };
  if (data.status !== "OK" || !data.candidates?.[0]) return null;
  const c = data.candidates[0];
  if (c.place_id) {
    const detailed = await fetchPlaceDetails(c.place_id, apiKey);
    if (detailed) return detailed;
  }
  return {
    placeName: c.name ?? query,
    rating: typeof c.rating === "number" ? c.rating : null,
    reviewCount: typeof c.user_ratings_total === "number" ? c.user_ratings_total : null,
    source: "places_api",
  };
}

export async function fetchGbpPlaceInsights(params: {
  profileUrl?: string | null;
  businessName?: string | null;
  city?: string | null;
}): Promise<GbpPlaceInsights | null> {
  const apiKey = placesApiKey();
  if (!apiKey) return null;

  if (params.profileUrl && textContainsGbpUrl(params.profileUrl)) {
    const placeId = extractPlaceIdFromUrl(params.profileUrl);
    if (placeId) {
      const details = await fetchPlaceDetails(placeId, apiKey);
      if (details) return details;
    }
  }

  const name = params.businessName?.trim();
  if (!name) return null;
  const query = [name, params.city?.trim()].filter(Boolean).join(" ");
  return findPlaceFromText(query, apiKey);
}

export function isGbpPlacesApiConfigured(): boolean {
  return Boolean(placesApiKey());
}

export type GbpPlaceReview = {
  id: string;
  author: string;
  rating: number;
  text: string;
  publishedAt: string | null;
};

/** Recensioni testuali via Places Details (max ~5). */
export async function fetchPlaceReviews(
  placeIdOrUrl: string
): Promise<{ placeName: string; reviews: GbpPlaceReview[] } | null> {
  const apiKey = placesApiKey();
  if (!apiKey) return null;

  const placeId =
    placeIdOrUrl.startsWith("ChIJ") || /^[A-Za-z0-9_-]{15,}$/.test(placeIdOrUrl)
      ? placeIdOrUrl
      : extractPlaceIdFromUrl(placeIdOrUrl);
  if (!placeId) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "name,reviews,rating,user_ratings_total");
  url.searchParams.set("reviews_sort", "newest");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    result?: {
      name?: string;
      reviews?: {
        author_name?: string;
        rating?: number;
        text?: string;
        time?: number;
        relative_time_description?: string;
      }[];
    };
  };

  if (data.status !== "OK" || !data.result) return null;

  const reviews: GbpPlaceReview[] = (data.result.reviews ?? []).map((r, i) => ({
    id: `places-${placeId}-${i}`,
    author: r.author_name ?? "Anonimo",
    rating: typeof r.rating === "number" ? r.rating : 0,
    text: r.text?.trim() || "(nessun testo)",
    publishedAt: r.time ? new Date(r.time * 1000).toISOString() : null,
  }));

  return {
    placeName: data.result.name ?? "Google Business",
    reviews,
  };
}
