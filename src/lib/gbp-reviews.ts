import { fetchGbpPlaceInsights, fetchPlaceReviews, isGbpPlacesApiConfigured } from "@/lib/gbp-places-api";
import { isGbpBusinessConnected, loadGbpBusinessAccessToken } from "@/lib/gbp-business-oauth";
import { resolveGbpLocationName } from "@/lib/gbp-location";

export type GbpReviewItem = {
  id: string;
  author: string;
  rating: number;
  text: string;
  publishedAt: string | null;
};

export type GbpReviewsLoadResult =
  | { ok: true; source: "places" | "oauth"; reviews: GbpReviewItem[]; placeName?: string }
  | { ok: false; reason: "not_configured" | "no_place" | "unavailable" };

/** Carica recensioni: Places API (testi) o GBP OAuth quando disponibile. */
export async function loadGbpReviewsForPlace(
  ownerUserId: string,
  placeIdOrUrl: string | null | undefined,
  assetGbpLocationName?: string | null
): Promise<GbpReviewsLoadResult> {
  const placeRef = placeIdOrUrl?.trim();
  if (!placeRef) return { ok: false, reason: "no_place" };

  const locationName = resolveGbpLocationName(assetGbpLocationName);

  if (await isGbpBusinessConnected(ownerUserId)) {
    const token = await loadGbpBusinessAccessToken(ownerUserId);
    if (token) {
      const fromApi = await fetchReviewsViaBusinessApi(token, placeRef, locationName);
      if (fromApi && fromApi.reviews.length > 0) {
        return { ok: true, source: "oauth", reviews: fromApi.reviews, placeName: fromApi.placeName };
      }
    }
  }

  if (!isGbpPlacesApiConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const withReviews = await fetchPlaceReviews(placeRef);
  if (withReviews && withReviews.reviews.length > 0) {
    return {
      ok: true,
      source: "places",
      reviews: withReviews.reviews,
      placeName: withReviews.placeName,
    };
  }

  const details = await fetchGbpPlaceInsights({ profileUrl: placeRef });
  if (!details) return { ok: false, reason: "unavailable" };

  const reviews: GbpReviewItem[] = [];
  if (details.rating != null) {
    reviews.push({
      id: "places-summary",
      author: "Google Places",
      rating: details.rating,
      text: `${details.reviewCount ?? 0} recensioni (dettaglio testi non disponibile per questo place).`,
      publishedAt: null,
    });
  }

  return {
    ok: true,
    source: "places",
    reviews,
    placeName: details.placeName,
  };
}

async function fetchReviewsViaBusinessApi(
  accessToken: string,
  placeRef: string,
  locationName: string | null
): Promise<{ reviews: GbpReviewItem[]; placeName?: string } | null> {
  if (!locationName) return null;

  const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 600 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    reviews?: {
      reviewId?: string;
      reviewer?: { displayName?: string };
      starRating?: string;
      comment?: string;
      createTime?: string;
    }[];
  };

  const reviews: GbpReviewItem[] = (data.reviews ?? []).map((r) => ({
    id: r.reviewId ?? `gbp-${placeRef}`,
    author: r.reviewer?.displayName ?? "Cliente Google",
    rating: starRatingToNumber(r.starRating),
    text: r.comment?.trim() || "(nessun testo)",
    publishedAt: r.createTime ?? null,
  }));

  return { reviews, placeName: undefined };
}

function starRatingToNumber(raw?: string): number {
  switch (raw) {
    case "FIVE":
      return 5;
    case "FOUR":
      return 4;
    case "THREE":
      return 3;
    case "TWO":
      return 2;
    case "ONE":
      return 1;
    default:
      return 0;
  }
}

export async function replyToGbpReview(
  ownerUserId: string,
  reviewId: string,
  replyText: string,
  assetGbpLocationName?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = replyText.trim();
  if (!text) return { ok: false, error: "Risposta vuota." };
  if (text.length > 4000) return { ok: false, error: "Risposta troppo lunga." };

  const locationName = resolveGbpLocationName(assetGbpLocationName);
  if (!(await isGbpBusinessConnected(ownerUserId)) || !locationName) {
    return {
      ok: false,
      error:
        "Risposta live richiede GBP OAuth e location (campo asset o GOOGLE_GBP_LOCATION_NAME).",
    };
  }

  const token = await loadGbpBusinessAccessToken(ownerUserId);
  if (!token) return { ok: false, error: "Token GBP scaduto. Ricollega da Impostazioni." };

  const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: text }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, error: errText.slice(0, 200) || `GBP API HTTP ${res.status}` };
  }

  return { ok: true };
}
