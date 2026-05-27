/** Risolve location GBP: asset > env globale. */
export function resolveGbpLocationName(assetLocation?: string | null): string | null {
  const fromAsset = assetLocation?.trim();
  if (fromAsset) return fromAsset;
  return process.env.GOOGLE_GBP_LOCATION_NAME?.trim() || null;
}
