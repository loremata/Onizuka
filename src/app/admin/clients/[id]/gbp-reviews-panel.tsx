import { loadGbpReviewsForPlace } from "@/lib/gbp-reviews";
import { isGbpBusinessOAuthConfigured } from "@/lib/gbp-business-oauth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GbpReviewReplyForm } from "./gbp-review-reply-form";
import { GbpAssetPicker } from "./gbp-asset-picker";

export async function GbpReviewsPanel({
  ownerUserId,
  clientId,
  assets,
  selectedAssetId,
}: {
  ownerUserId: string;
  clientId: string;
  assets: { id: string; name: string; profileUrl: string | null; gbpLocationName?: string | null }[];
  selectedAssetId?: string;
}) {
  const gbpAssets = assets.filter((a) => a.profileUrl?.trim());
  if (gbpAssets.length === 0) return null;

  const selected =
    gbpAssets.find((a) => a.id === selectedAssetId) ?? gbpAssets[0];

  const loaded = await loadGbpReviewsForPlace(
    ownerUserId,
    selected.profileUrl,
    selected.gbpLocationName
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recensioni Google</CardTitle>
        <CardDescription>
          {loaded.ok
            ? `${selected.name} · ${loaded.source === "oauth" ? "GBP OAuth" : "Places API"}${loaded.placeName ? ` · ${loaded.placeName}` : ""}`
            : isGbpBusinessOAuthConfigured()
              ? "Collega GBP da Impostazioni per risposte dirette."
              : "Configura GOOGLE_PLACES_API_KEY o GBP OAuth."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <GbpAssetPicker
          clientId={clientId}
          assets={gbpAssets.map((a) => ({ id: a.id, name: a.name }))}
          selectedAssetId={selected.id}
        />
        {loaded.ok ? (
          <ul className="divide-y divide-border/60">
            {loaded.reviews.map((r) => (
              <li key={r.id} className="py-2">
                <p className="font-medium">
                  {r.author} · {r.rating}/5
                </p>
                <p className="text-muted-foreground">{r.text}</p>
                <GbpReviewReplyForm
                  clientId={clientId}
                  reviewId={r.id}
                  assetId={selected.id}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Recensioni non disponibili per questo asset.</p>
        )}
      </CardContent>
    </Card>
  );
}
