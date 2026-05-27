import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type MetaCommentStub = {
  id: string;
  message?: string;
  from?: { name?: string };
  created_time?: string;
};

function metaAccessToken(): string | null {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || null;
}

function metaPageId(): string | null {
  return process.env.META_PAGE_ID?.trim() || process.env.FACEBOOK_PAGE_ID?.trim() || null;
}

export function isMetaCommentsSyncConfigured(): boolean {
  return !!(metaAccessToken() && metaPageId());
}

/** Import commenti post pagina Facebook (Graph API) nell'inbox Social. */
export async function syncMetaPageComments(limit = 25): Promise<{
  imported: number;
  skipped: number;
  error?: string;
}> {
  const token = metaAccessToken();
  const pageId = metaPageId();
  if (!token || !pageId) {
    return { imported: 0, skipped: 0, error: "META_PAGE_ACCESS_TOKEN e META_PAGE_ID richiesti." };
  }

  const postsRes = await fetch(
    `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message&limit=10&access_token=${encodeURIComponent(token)}`
  );
  if (!postsRes.ok) {
    return { imported: 0, skipped: 0, error: `Graph posts HTTP ${postsRes.status}` };
  }

  const postsJson = (await postsRes.json()) as { data?: { id: string }[] };
  const posts = postsJson.data ?? [];
  let imported = 0;
  let skipped = 0;

  for (const post of posts.slice(0, 5)) {
    const commentsRes = await fetch(
      `https://graph.facebook.com/v19.0/${post.id}/comments?fields=id,message,from,created_time&limit=${limit}&access_token=${encodeURIComponent(token)}`
    );
    if (!commentsRes.ok) continue;
    const commentsJson = (await commentsRes.json()) as { data?: MetaCommentStub[] };
    for (const c of commentsJson.data ?? []) {
      const externalId = `meta:${c.id}`;
      const existing = await prisma.socialInboxComment.findFirst({
        where: { OR: [{ externalId: c.id }, { body: { contains: externalId } }] },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const body = [c.message ?? "(senza testo)", `[${externalId}]`].join("\n");
      await prisma.socialInboxComment.create({
        data: {
          platform: "FACEBOOK" as Platform,
          authorName: c.from?.name ?? "Meta",
          body,
          externalId: c.id,
          externalUrl: `https://facebook.com/${c.id}`,
          receivedAt: c.created_time ? new Date(c.created_time) : new Date(),
        },
      });
      imported += 1;
    }
  }

  return { imported, skipped };
}
