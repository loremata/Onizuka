import { prisma } from "@/lib/prisma";
import { fetchGbpPlaceInsights } from "@/lib/gbp-places-api";
import type { SectionAnalysis } from "@/lib/digital-audit-run";

export type GbpAuditSnapshot = {
  gbpRating: number | null;
  gbpReviewCount: number | null;
  gbpPlaceName: string | null;
  gbpCategories: string[];
  gbpHasHours: boolean;
  gbpPhotoCount: number;
  gbpWebsite: string | null;
  gbpPhone: string | null;
};

/** Recupera solo lo snapshot GBP (rating/recensioni/nome) — per il nuovo motore di scoring. */
export async function fetchGbpSnapshot(params: {
  clientId: string | null;
  businessName: string | null;
  city: string | null;
  phone?: string | null;
}): Promise<GbpAuditSnapshot | null> {
  const assets = params.clientId
    ? await prisma.asset.findMany({
        where: { clientId: params.clientId, platform: "GBP" },
        select: { profileUrl: true, notes: true },
      })
    : [];
  const profileUrl =
    assets.find((a) => a.profileUrl?.trim())?.profileUrl ??
    assets.find((a) => a.notes && /g\.page|google\.com\/maps/i.test(a.notes))?.notes ??
    null;
  const insights = await fetchGbpPlaceInsights({
    profileUrl,
    businessName: params.businessName,
    city: params.city,
    phone: params.phone,
  });
  if (!insights || insights.source === "none") return null;
  return {
    gbpRating: insights.rating,
    gbpReviewCount: insights.reviewCount,
    gbpPlaceName: insights.placeName,
    gbpCategories: insights.categories,
    gbpHasHours: insights.hasHours,
    gbpPhotoCount: insights.photoCount,
    gbpWebsite: insights.website,
    gbpPhone: insights.phone,
  };
}

export async function applyGbpEnrichmentToSections(params: {
  clientId: string | null;
  businessName: string | null;
  city: string | null;
  sections: SectionAnalysis[];
}): Promise<{ sections: SectionAnalysis[]; gbp: GbpAuditSnapshot | null }> {
  const assets = params.clientId
    ? await prisma.asset.findMany({
        where: { clientId: params.clientId, platform: "GBP" },
        select: { profileUrl: true, notes: true },
      })
    : [];

  const profileUrl =
    assets.find((a) => a.profileUrl?.trim())?.profileUrl ??
    assets.find((a) => a.notes && /g\.page|google\.com\/maps/i.test(a.notes))?.notes ??
    null;

  const insights = await fetchGbpPlaceInsights({
    profileUrl,
    businessName: params.businessName,
    city: params.city,
  });

  if (!insights || insights.source === "none") {
    return { sections: params.sections, gbp: null };
  }

  const gbp: GbpAuditSnapshot = {
    gbpRating: insights.rating,
    gbpReviewCount: insights.reviewCount,
    gbpPlaceName: insights.placeName,
    gbpCategories: insights.categories,
    gbpHasHours: insights.hasHours,
    gbpPhotoCount: insights.photoCount,
    gbpWebsite: insights.website,
    gbpPhone: insights.phone,
  };

  const sections = params.sections.map((s) => {
    if (s.sectionKey === "REVIEWS" && insights.reviewCount != null) {
      const ratingTxt = insights.rating != null ? ` · ${insights.rating}/5` : "";
      return {
        ...s,
        score: Math.min(85, Math.max(s.score, insights.reviewCount >= 20 ? 68 : insights.reviewCount >= 5 ? 58 : 50)),
        positives: [s.positives, `${insights.reviewCount} recensioni Google${ratingTxt} (${insights.placeName}).`]
          .filter(Boolean)
          .join(" "),
        issues:
          insights.rating != null && insights.rating < 4
            ? "Valutazione sotto 4: priorità risposta recensioni negative."
            : s.issues,
      };
    }
    if (s.sectionKey === "LOCAL") {
      return {
        ...s,
        score: Math.min(88, s.score + 6),
        positives: [s.positives, `Profilo Google verificato: ${insights.placeName}.`].filter(Boolean).join(" "),
      };
    }
    return s;
  });

  return { sections, gbp };
}

export function formatGbpAuditSummary(audit: {
  gbpRating: number | null;
  gbpReviewCount: number | null;
  gbpPlaceName?: string | null;
}): string | null {
  if (!audit.gbpPlaceName && audit.gbpReviewCount == null) return null;
  const parts: string[] = [];
  if (audit.gbpPlaceName) parts.push(audit.gbpPlaceName);
  if (audit.gbpRating != null) parts.push(`${audit.gbpRating}/5`);
  if (audit.gbpReviewCount != null) parts.push(`${audit.gbpReviewCount} recensioni`);
  return parts.length ? parts.join(" · ") : null;
}
