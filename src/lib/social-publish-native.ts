import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishPostToMetaPage, isMetaNativePublishConfigured } from "@/lib/social-publish-meta";
import {
  isLinkedInNativePublishConfigured,
  publishPostToLinkedIn,
} from "@/lib/social-publish-linkedin";
import { isGbpNativePublishConfigured, publishPostToGbpLocation } from "@/lib/social-publish-gbp";
import { getSocialAccountToken } from "@/lib/social-account";

export type NativePublishResult =
  | { ok: true; externalRef: string; publishUrl?: string }
  | { error: string };

export async function publishPostItemNative(postId: string): Promise<NativePublishResult> {
  const post = await prisma.postItem.findUnique({
    where: { id: postId },
    include: {
      media: { take: 1, orderBy: { createdAt: "asc" } },
      socialAccount: true,
    },
  });
  if (!post) return { error: "Post non trovato." };

  const caption = post.captionText.trim() || "Nuovo contenuto";
  const mediaUrl = post.media[0]?.url;

  // Publisher multi-tenant: se il post ha un account collegato usa il SUO token,
  // altrimenti fallback ai token env (comportamento legacy).
  const account = post.socialAccount;
  if (account && account.status !== "CONNECTED") {
    return { error: `Account ${account.displayName} non collegato (stato ${account.status}).` };
  }
  const accountToken = account ? getSocialAccountToken(account)?.accessToken : undefined;

  let externalRef: string | undefined;
  let publishUrl: string | undefined;

  if (post.platform === "FACEBOOK" || post.platform === "INSTAGRAM") {
    if (!accountToken && !isMetaNativePublishConfigured()) {
      return { error: "Meta publish non configurato (nessun account collegato né META_PAGE_ACCESS_TOKEN/META_PAGE_ID)." };
    }
    const r = await publishPostToMetaPage({
      message: caption,
      link: mediaUrl,
      accessToken: accountToken,
      pageId: account?.pageId ?? undefined,
    });
    if ("error" in r) return r;
    externalRef = r.externalId;
    publishUrl = `https://www.facebook.com/${r.externalId}`;
  } else if (post.platform === "LINKEDIN") {
    if (!accountToken && !isLinkedInNativePublishConfigured()) {
      return { error: "LinkedIn publish non configurato (nessun account collegato né token env)." };
    }
    const r = await publishPostToLinkedIn({
      text: caption,
      mediaUrl: mediaUrl ?? undefined,
      accessToken: accountToken,
      authorUrn: account?.authorUrn ?? undefined,
    });
    if ("error" in r) return r;
    externalRef = r.externalId;
  } else if (post.platform === "GBP") {
    if (!accountToken && !isGbpNativePublishConfigured()) {
      return { error: "Google Business publish non configurato (nessun account collegato né env GOOGLE_GBP_*)." };
    }
    const r = await publishPostToGbpLocation({
      summary: caption,
      accessToken: accountToken,
      locationName: account?.locationName ?? undefined,
    });
    if ("error" in r) return r;
    externalRef = r.externalId;
    publishUrl = r.publishUrl;
  } else {
    return { error: `Piattaforma ${post.platform} non supportata per publish nativo.` };
  }

  await prisma.postItem.update({
    where: { id: postId },
    data: {
      publishedAt: new Date(),
      externalRef,
      publishUrl: publishUrl ?? null,
      status: "APPROVED",
      awaitingClientReview: false,
      errorDetail: null,
    },
  });

  return { ok: true, externalRef: externalRef!, publishUrl };
}

export function nativePublishAvailableForPlatform(platform: Platform): boolean {
  if (platform === "LINKEDIN") return isLinkedInNativePublishConfigured();
  if (platform === "FACEBOOK" || platform === "INSTAGRAM") return isMetaNativePublishConfigured();
  if (platform === "GBP") return isGbpNativePublishConfigured();
  return false;
}
