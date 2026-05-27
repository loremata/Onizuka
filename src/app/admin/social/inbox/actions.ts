"use server";

import { revalidatePath } from "next/cache";
import type { Platform } from "@prisma/client";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];

export async function createSocialInboxComment(formData: FormData) {
  await requireAdminArea();
  const platform = formData.get("platform") as Platform;
  const body = (formData.get("body") as string)?.trim();
  const authorName = (formData.get("authorName") as string)?.trim() || null;
  const clientId = (formData.get("clientId") as string)?.trim() || null;
  const externalUrl = (formData.get("externalUrl") as string)?.trim() || null;

  if (!PLATFORMS.includes(platform)) return { error: "Piattaforma non valida." };
  if (!body || body.length < 2) return { error: "Testo commento obbligatorio." };

  await prisma.socialInboxComment.create({
    data: { platform, body, authorName, clientId, externalUrl },
  });

  revalidatePath("/admin/social/inbox");
  return { ok: true as const };
}

export async function markSocialCommentReplied(id: string) {
  await requireAdminArea();
  await prisma.socialInboxComment.update({
    where: { id },
    data: { repliedAt: new Date() },
  });
  revalidatePath("/admin/social/inbox");
}

export async function replySocialInboxComment(
  commentId: string,
  replyText: string
): Promise<{ error: string } | { ok: true }> {
  await requireAdminArea();
  const { replyToSocialInboxComment } = await import("@/lib/social-comment-reply");
  const result = await replyToSocialInboxComment({ commentId, replyText });
  if ("error" in result) return { error: result.error };
  revalidatePath("/admin/social/inbox");
  return { ok: true };
}
