export function isGbpNativePublishConfigured(): boolean {
  return !!(
    process.env.GOOGLE_GBP_ACCESS_TOKEN?.trim() && process.env.GOOGLE_GBP_LOCATION_NAME?.trim()
  );
}

/**
 * Pubblica un post locale sulla scheda Google Business Profile (Google My Business API v4, localPosts).
 * NB: il token GBP è OAuth e scade (~1h): in produzione va rinfrescato col refresh token
 * (SocialAccount.tokenCipher deve contenere un accessToken valido; refresh gestito a monte).
 */
export async function publishPostToGbpLocation(params: {
  summary: string;
  /// Override per-account (Publisher multi-tenant). Se assenti, fallback env.
  accessToken?: string;
  locationName?: string;
}): Promise<{ externalId: string; publishUrl?: string } | { error: string }> {
  const token = params.accessToken?.trim() || process.env.GOOGLE_GBP_ACCESS_TOKEN?.trim();
  const location = params.locationName?.trim() || process.env.GOOGLE_GBP_LOCATION_NAME?.trim();
  if (!token || !location) {
    return { error: "GBP publish non configurato (account senza token/location o env GOOGLE_GBP_*)." };
  }

  const res = await fetch(`https://mybusiness.googleapis.com/v4/${location}/localPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      languageCode: "it",
      summary: params.summary.slice(0, 1500),
      topicType: "STANDARD",
    }),
  });

  const json = (await res.json()) as {
    name?: string;
    searchUrl?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.name) {
    return { error: json.error?.message ?? `GBP API ${res.status}` };
  }
  return { externalId: json.name, publishUrl: json.searchUrl };
}
