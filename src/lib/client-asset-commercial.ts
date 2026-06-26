import { prisma } from "@/lib/prisma";

export type AssetCommercialRow = {
  assetId: string;
  assetName: string;
  platform: string | null;
  openOpportunities: number;
  pipelineEur: string;
  wonEur: string;
};

export async function loadClientAssetCommercialSummary(
  clientId: string,
  ownerUserId: string
): Promise<AssetCommercialRow[]> {
  // Query indipendenti (le opportunità filtrano per clientId/ownerUserId, non per i valori asset) → parallele.
  const [assets, opportunities] = await Promise.all([
    prisma.asset.findMany({
      where: { clientId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, platform: true },
    }),
    prisma.opportunity.findMany({
      where: { clientId, ownerUserId, assetId: { not: null } },
      select: { assetId: true, status: true, estimatedValue: true },
    }),
  ]);

  if (assets.length === 0) return [];

  const byAsset = new Map<string, { open: number; openSum: number; wonSum: number }>();
  for (const a of assets) {
    byAsset.set(a.id, { open: 0, openSum: 0, wonSum: 0 });
  }

  for (const o of opportunities) {
    if (!o.assetId) continue;
    const bucket = byAsset.get(o.assetId);
    if (!bucket) continue;
    const val = o.estimatedValue ? Number(o.estimatedValue.toString()) : 0;
    if (o.status === "OPEN") {
      bucket.open += 1;
      if (!Number.isNaN(val)) bucket.openSum += val;
    }
    if (o.status === "WON" && !Number.isNaN(val)) {
      bucket.wonSum += val;
    }
  }

  return assets.map((a) => {
    const b = byAsset.get(a.id)!;
    return {
      assetId: a.id,
      assetName: a.name,
      platform: a.platform,
      openOpportunities: b.open,
      pipelineEur: b.openSum.toLocaleString("it-IT", { maximumFractionDigits: 0 }),
      wonEur: b.wonSum.toLocaleString("it-IT", { maximumFractionDigits: 0 }),
    };
  });
}
