import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function linkedInToken(): string | null {
  return process.env.LINKEDIN_ACCESS_TOKEN?.trim() || null;
}

export function isLinkedInCommentsSyncConfigured(): boolean {
  return !!linkedInToken();
}

/** Import commenti post organizzazione LinkedIn (REST Community Management). */
export async function syncLinkedInPostComments(limit = 20): Promise<{
  imported: number;
  skipped: number;
  error?: string;
}> {
  const token = linkedInToken();
  const orgUrn = process.env.LINKEDIN_ORGANIZATION_URN?.trim();
  if (!token) return { imported: 0, skipped: 0, error: "LINKEDIN_ACCESS_TOKEN richiesto." };
  if (!orgUrn) return { imported: 0, skipped: 0, error: "LINKEDIN_ORGANIZATION_URN richiesto." };

  const postsRes = await fetch(
    `https://api.linkedin.com/rest/posts?q=author&author=${encodeURIComponent(orgUrn)}&count=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202405",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    }
  );
  if (!postsRes.ok) {
    return { imported: 0, skipped: 0, error: `LinkedIn posts HTTP ${postsRes.status}` };
  }

  const postsJson = (await postsRes.json()) as { elements?: { id?: string }[] };
  let imported = 0;
  let skipped = 0;

  for (const post of postsJson.elements ?? []) {
    if (!post.id) continue;
    const commentsRes = await fetch(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(post.id)}/comments?count=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "LinkedIn-Version": "202405",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    if (!commentsRes.ok) continue;
    const commentsJson = (await commentsRes.json()) as {
      elements?: { id?: string; message?: { text?: string }; actor?: string; created?: { time?: number } }[];
    };
    for (const c of commentsJson.elements ?? []) {
      const externalId = `linkedin:${c.id ?? ""}`;
      if (!c.id) continue;
      const ext = c.id ?? "";
      const existing = await prisma.socialInboxComment.findFirst({
        where: { OR: [{ externalId: ext }, { body: { contains: externalId } }] },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.socialInboxComment.create({
        data: {
          platform: "LINKEDIN" as Platform,
          authorName: c.actor?.slice(0, 80) ?? "LinkedIn",
          body: [c.message?.text ?? "(senza testo)", `[${externalId}]`].join("\n"),
          externalId: ext || null,
          receivedAt: c.created?.time ? new Date(c.created.time) : new Date(),
        },
      });
      imported += 1;
    }
  }

  return { imported, skipped };
}
