import type { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function parseExternalId(body: string, platform: Platform): string | null {
  const tag =
    platform === "FACEBOOK"
      ? "meta:"
      : platform === "INSTAGRAM"
        ? "ig:"
        : platform === "LINKEDIN"
          ? "linkedin:"
          : null;
  if (!tag) return null;
  const m = body.match(new RegExp(`\\[${tag}([^\\]]+)\\]`));
  return m?.[1]?.trim() ?? null;
}

function metaToken(): string | null {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() || null;
}

/** Pubblica risposta al commento via API piattaforma. */
export async function replyToSocialInboxComment(params: {
  commentId: string;
  replyText: string;
}): Promise<{ ok: true; externalReplyId?: string } | { error: string }> {
  const text = params.replyText.trim();
  if (!text) return { error: "Testo risposta obbligatorio." };

  const comment = await prisma.socialInboxComment.findUnique({
    where: { id: params.commentId },
    select: {
      id: true,
      platform: true,
      body: true,
      externalId: true,
      repliedAt: true,
    },
  });
  if (!comment) return { error: "Commento non trovato." };
  if (comment.repliedAt) return { error: "Già risposto." };

  const externalId = comment.externalId ?? parseExternalId(comment.body, comment.platform);
  if (!externalId) return { error: "ID esterno commento non trovato (sync API richiesto)." };

  let externalReplyId: string | undefined;

  if (comment.platform === "FACEBOOK" || comment.platform === "INSTAGRAM") {
    const token = metaToken();
    if (!token) return { error: "META_PAGE_ACCESS_TOKEN non configurato." };
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${externalId}/comments?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.slice(0, 2000) }),
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { error: `Meta reply ${res.status}: ${err.slice(0, 200)}` };
    }
    const json = (await res.json()) as { id?: string };
    externalReplyId = json.id;
  } else if (comment.platform === "LINKEDIN") {
    const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
    if (!token) return { error: "LINKEDIN_ACCESS_TOKEN non configurato." };
    const res = await fetch(
      `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(externalId)}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": "202405",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          actor: process.env.LINKEDIN_ORGANIZATION_URN?.trim(),
          message: { text: text.slice(0, 2000) },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { error: `LinkedIn reply ${res.status}: ${err.slice(0, 200)}` };
    }
    externalReplyId = "linkedin-reply";
  } else {
    return { error: "Piattaforma non supportata per risposta API." };
  }

  await prisma.socialInboxComment.update({
    where: { id: comment.id },
    data: {
      repliedAt: new Date(),
      replyBody: text,
      replyExternalId: externalReplyId ?? null,
      externalId: externalId,
    },
  });

  return { ok: true, externalReplyId };
}
