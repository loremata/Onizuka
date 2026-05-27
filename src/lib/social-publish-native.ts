import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publishPostToMetaPage, isMetaNativePublishConfigured } from "@/lib/social-publish-meta";
import {
  isLinkedInNativePublishConfigured,
  publishPostToLinkedIn,
} from "@/lib/social-publish-linkedin";

export type NativePublishResult =
  | { ok: true; externalRef: string; publishUrl?: string }
  | { error: string };

export async function publishPostItemNative(postId: string): Promise<NativePublishResult> {
  const post = await prisma.postItem.findUnique({
    where: { id: postId },
    include: { media: { take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (!post) return { error: "Post non trovato." };

  const caption = post.captionText.trim() || "Nuovo contenuto";
  const mediaUrl = post.media[0]?.url;

  let externalRef: string | undefined;
  let publishUrl: string | undefined;
  let err: string | undefined;

  if (post.platform === "FACEBOOK" || post.platform === "INSTAGRAM") {
    if (!isMetaNativePublishConfigured()) {
      return { error: "Meta publish non configurato (META_PAGE_ACCESS_TOKEN + META_PAGE_ID)." };
    }
    const r = await publishPostToMetaPage({
      message: caption,
      link: mediaUrl,
    });
    if ("error" in r) return r;
    externalRef = r.externalId;
    publishUrl = `https://www.facebook.com/${r.externalId}`;
  } else if (post.platform === "LINKEDIN") {
    if (!isLinkedInNativePublishConfigured()) {
      return { error: "LinkedIn publish non configurato." };
    }
    const r = await publishPostToLinkedIn({ text: caption, mediaUrl: mediaUrl ?? undefined });
    if ("error" in r) return r;
    externalRef = r.externalId;
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
    },
  });

  return { ok: true, externalRef: externalRef!, publishUrl };
}

export function nativePublishAvailableForPlatform(platform: Platform): boolean {
  if (platform === "LINKEDIN") return isLinkedInNativePublishConfigured();
  if (platform === "FACEBOOK" || platform === "INSTAGRAM") return isMetaNativePublishConfigured();
  return false;
}
