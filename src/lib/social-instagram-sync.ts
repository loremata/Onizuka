import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function metaToken(): string | null {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || null;
}

function igAccountId(): string | null {
  return process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() || null;
}

export function isInstagramCommentsSyncConfigured(): boolean {
  return !!(metaToken() && igAccountId());
}

/** Commenti media Instagram Business (Graph API). */
export async function syncInstagramMediaComments(limit = 25): Promise<{
  imported: number;
  skipped: number;
  error?: string;
}> {
  const token = metaToken();
  const igId = igAccountId();
  if (!token || !igId) {
    return {
      imported: 0,
      skipped: 0,
      error: "META_PAGE_ACCESS_TOKEN e INSTAGRAM_BUSINESS_ACCOUNT_ID richiesti.",
    };
  }

  const mediaRes = await fetch(
    `https://graph.facebook.com/v19.0/${igId}/media?fields=id,caption,timestamp&limit=8&access_token=${encodeURIComponent(token)}`
  );
  if (!mediaRes.ok) {
    return { imported: 0, skipped: 0, error: `Instagram media HTTP ${mediaRes.status}` };
  }

  const mediaJson = (await mediaRes.json()) as { data?: { id: string }[] };
  let imported = 0;
  let skipped = 0;

  for (const media of mediaJson.data ?? []) {
    const commentsRes = await fetch(
      `https://graph.facebook.com/v19.0/${media.id}/comments?fields=id,text,username,timestamp&limit=${limit}&access_token=${encodeURIComponent(token)}`
    );
    if (!commentsRes.ok) continue;
    const commentsJson = (await commentsRes.json()) as {
      data?: { id: string; text?: string; username?: string; timestamp?: string }[];
    };
    for (const c of commentsJson.data ?? []) {
      const externalId = `ig:${c.id}`;
      const existing = await prisma.socialInboxComment.findFirst({
        where: { OR: [{ externalId: c.id }, { body: { contains: externalId } }] },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.socialInboxComment.create({
        data: {
          platform: "INSTAGRAM" as Platform,
          authorName: c.username ?? "Instagram",
          body: [c.text ?? "(senza testo)", `[${externalId}]`].join("\n"),
          externalId: c.id,
          externalUrl: `https://instagram.com/p/${media.id}`,
          receivedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
        },
      });
      imported += 1;
    }
  }

  return { imported, skipped };
}
