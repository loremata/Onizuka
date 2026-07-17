import { prisma } from "@/lib/prisma";
import { getSocialAccountToken } from "@/lib/social-account";
import { fetchMetaPostMetrics } from "@/lib/social-metrics-meta";

export type MetricsRefreshResult =
  | { ok: true; updated: boolean; impressions?: number; reach?: number; engagement?: number }
  | { error: string }
  | { skipped: string };

/**
 * Aggiorna impression/reach/engagement di un post pubblicato leggendoli dalla piattaforma,
 * usando il token cifrato del SocialAccount collegato. Scrive su PostItem (→ visibile a cliente e admin).
 */
export async function refreshPostItemMetrics(postId: string): Promise<MetricsRefreshResult> {
  const post = await prisma.postItem.findUnique({
    where: { id: postId },
    include: { socialAccount: true },
  });
  if (!post) return { error: "Post non trovato." };
  if (!post.externalRef) return { skipped: "Nessun riferimento esterno (post non pubblicato via API)." };

  const account = post.socialAccount;
  if (!account) return { skipped: "Nessun account collegato." };
  if (account.status !== "CONNECTED") return { skipped: `Account ${account.status}.` };

  const token = getSocialAccountToken(account)?.accessToken;
  if (!token) return { skipped: "Token account assente." };

  let fetched: { impressions?: number; reach?: number; engagement?: number } | { error: string };
  if (post.platform === "FACEBOOK" || post.platform === "INSTAGRAM") {
    fetched = await fetchMetaPostMetrics({ postId: post.externalRef, accessToken: token });
  } else {
    // LinkedIn / GBP: ingest metriche non ancora implementato (Fase 3+).
    return { skipped: `Metriche non supportate per ${post.platform}.` };
  }

  if ("error" in fetched) return { error: fetched.error };

  const data: { impressions?: number; reach?: number; engagement?: number } = {};
  if (typeof fetched.impressions === "number") data.impressions = fetched.impressions;
  if (typeof fetched.reach === "number") data.reach = fetched.reach;
  if (typeof fetched.engagement === "number") data.engagement = fetched.engagement;

  if (Object.keys(data).length === 0) {
    return { ok: true, updated: false };
  }

  await prisma.postItem.update({ where: { id: postId }, data });
  return { ok: true, updated: true, ...data };
}
