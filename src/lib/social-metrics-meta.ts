export type FetchedMetrics = { impressions?: number; reach?: number; engagement?: number };

type MetaInsightsResponse = {
  data?: { name: string; values?: { value: number }[] }[];
  error?: { message?: string };
};

/**
 * Legge gli insight di un post di Pagina Facebook via Graph API.
 * impressions = post_impressions · reach = post_impressions_unique · engagement = post_engaged_users.
 */
export async function fetchMetaPostMetrics(params: {
  postId: string;
  accessToken: string;
}): Promise<FetchedMetrics | { error: string }> {
  const metrics = "post_impressions,post_impressions_unique,post_engaged_users";
  const url =
    `https://graph.facebook.com/v19.0/${params.postId}/insights` +
    `?metric=${metrics}&access_token=${encodeURIComponent(params.accessToken)}`;

  const res = await fetch(url);
  const json = (await res.json()) as MetaInsightsResponse;
  if (!res.ok || json.error) {
    return { error: json.error?.message ?? `Graph API ${res.status}` };
  }

  const byName = new Map<string, number>();
  for (const row of json.data ?? []) {
    const value = row.values?.[0]?.value;
    if (typeof value === "number") byName.set(row.name, value);
  }

  const out: FetchedMetrics = {};
  if (byName.has("post_impressions")) out.impressions = byName.get("post_impressions");
  if (byName.has("post_impressions_unique")) out.reach = byName.get("post_impressions_unique");
  if (byName.has("post_engaged_users")) out.engagement = byName.get("post_engaged_users");
  return out;
}
