import type { Platform } from "@prisma/client";

const GBP_URL_RE = /google\.[a-z.]+\/maps|maps\.google\.com|g\.page\/|business\.google\.com/i;

export type AssetGbpHint = {
  platform: Platform | null;
  profileUrl: string | null;
  notes: string | null;
};

export type GbpAuditSignals = {
  hasGbpAsset: boolean;
  hasGbpProfileUrl: boolean;
  hasGbpUrlInNotes: boolean;
  hasStrongGbp: boolean;
};

export function textContainsGbpUrl(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return GBP_URL_RE.test(text);
}

export function resolveGbpAuditSignals(
  assets: AssetGbpHint[],
  siteHasMapsLink = false
): GbpAuditSignals {
  const gbpAssets = assets.filter((a) => a.platform === "GBP");
  const hasGbpAsset = gbpAssets.length > 0;
  const hasGbpProfileUrl = gbpAssets.some((a) => textContainsGbpUrl(a.profileUrl));
  const hasGbpUrlInNotes = assets.some(
    (a) => a.platform === "GBP" && textContainsGbpUrl(a.notes)
  );
  const hasStrongGbp = hasGbpAsset && (hasGbpProfileUrl || hasGbpUrlInNotes || siteHasMapsLink);

  return {
    hasGbpAsset,
    hasGbpProfileUrl,
    hasGbpUrlInNotes,
    hasStrongGbp: hasStrongGbp || (hasGbpAsset && siteHasMapsLink),
  };
}
