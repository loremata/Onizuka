"use server";

import { revalidatePath } from "next/cache";
import type { Platform } from "@prisma/client";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { createPostWithMedia } from "@/lib/post-media-upload";
import { notifyAdminUsers } from "@/lib/user-notifications";
import { platformLabelIt } from "@/lib/post-ui-labels";

export type CreativeActionResult =
  | { error: string }
  | { ok: true; postId: string; postCount?: number }
  | null;

const VALID_PLATFORMS: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];

async function ensureClient() {
  const ctx = await requireAppClientContext();
  return { clientId: ctx.clientId, userId: ctx.userId, isAdminPreview: ctx.isAdminPreview };
}

export async function submitClientCreative(
  _prev: CreativeActionResult,
  formData: FormData
): Promise<CreativeActionResult> {
  const { clientId, userId, isAdminPreview } = await ensureClient();

  const platform = (formData.get("platform") as Platform) || "INSTAGRAM";
  const captionText = (formData.get("captionText") as string)?.trim() ?? "";
  const splitPosts = formData.get("splitPosts") === "on";

  if (!VALID_PLATFORMS.includes(platform)) return { error: "Piattaforma non valida." };

  const files = formData.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Carica almeno un'immagine o video." };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { companyName: true },
  });
  if (!client) return { error: "Cliente non trovato." };

  const fileGroups = splitPosts && files.length > 1 ? files.map((f) => [f]) : [files];

  let lastPostId = "";
  for (let i = 0; i < fileGroups.length; i++) {
    const group = fileGroups[i];
    const caption =
      splitPosts && files.length > 1
        ? captionText
          ? `${captionText} (${i + 1}/${fileGroups.length})`
          : `Materiale ${i + 1}/${fileGroups.length}`
        : captionText;

    const created = await createPostWithMedia({
      clientId,
      platform,
      captionText: caption,
      scheduledFor: null,
      createdByUserId: userId,
      awaitingClientReview: false,
      files: group,
    });

    if (!created.ok) return { error: created.error };
    lastPostId = created.postId;
  }

  if (isAdminPreview) {
    void logAuditEvent({
      actorUserId: userId,
      action: "client_preview.upload",
      entityType: "post",
      entityId: lastPostId,
      summary: `Upload materiale in anteprima admin (${platformLabelIt[platform]})`,
      metadata: { clientId, postCount: fileGroups.length },
    });
  } else {
    void notifyAdminUsers({
      kind: "post_client_upload",
      title: `Materiale dal cliente · ${client.companyName}`,
      body:
        fileGroups.length > 1
          ? `${fileGroups.length} post da revisionare (${platformLabelIt[platform]})`
          : `${platformLabelIt[platform]} — in revisione admin`,
      href: `/admin/posts/${lastPostId}`,
    }).catch(() => {});
  }

  revalidatePath("/app");
  revalidatePath("/app/upload");
  revalidatePath("/admin/posts");
  return {
    ok: true,
    postId: lastPostId,
    postCount: fileGroups.length > 1 ? fileGroups.length : undefined,
  };
}
