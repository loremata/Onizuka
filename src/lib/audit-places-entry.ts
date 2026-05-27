import { fetchGbpPlaceInsights } from "@/lib/gbp-places-api";
import { runDigitalAuditUnified } from "@/lib/audit-commercial-entry";

export type RunAuditFromGooglePlaceInput = {
  ownerUserId: string;
  googlePlaceId: string;
  businessName?: string | null;
  city?: string | null;
  website?: string | null;
  vatNumber?: string | null;
  createOutreachDraft?: boolean;
};

/**
 * Avvia audit da Google Places (place_id). Richiede P.IVA o lead/client già noto dopo matching.
 */
export async function runDigitalAuditFromGooglePlace(input: RunAuditFromGooglePlaceInput) {
  const insights = await fetchGbpPlaceInsights({
    businessName: input.businessName,
    city: input.city,
    profileUrl: input.website,
  });

  return runDigitalAuditUnified({
    ownerUserId: input.ownerUserId,
    googlePlaceId: input.googlePlaceId,
    businessName: input.businessName ?? insights?.placeName,
    city: input.city,
    website: input.website,
    vatNumber: input.vatNumber,
    acquisitionSource: "google_places",
    createOutreachDraft: input.createOutreachDraft,
  });
}
