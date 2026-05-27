"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { notifyAdminUsers, notifyClientUsers } from "@/lib/user-notifications";
import { createPostWithMedia } from "@/lib/post-media-upload";
import type { Platform } from "@prisma/client";

type ActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function createPost(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const clientId = (formData.get("clientId") as string)?.trim();
  const platform = (formData.get("platform") as Platform) || "FACEBOOK";
  const captionText = (formData.get("captionText") as string)?.trim() ?? "";
  const scheduledForRaw = (formData.get("scheduledFor") as string)?.trim();

  if (!clientId) return { error: "Seleziona un cliente." };

  const validPlatforms: Platform[] = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "GBP"];
  if (!validPlatforms.includes(platform)) return { error: "Piattaforma non valida." };

  const scheduledFor = scheduledForRaw
    ? new Date(scheduledForRaw)
    : null;
  if (scheduledForRaw && isNaN(scheduledFor!.getTime()))
    return { error: "Data di programmazione non valida." };

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "Cliente non trovato." };

  const files = formData.getAll("media").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "È richiesto almeno un file multimediale." };

  const created = await createPostWithMedia({
    clientId,
    platform,
    captionText,
    scheduledFor,
    createdByUserId: session.user.id,
    awaitingClientReview: true,
    files,
  });
  if (!created.ok) return { error: created.error };
  const postId = created.postId;

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "post.create",
    entityType: "post",
    entityId: postId,
    summary: `Creato post ${platform} per ${client.companyName}`,
    metadata: { clientId, platform },
  });

  void notifyClientUsers({
    clientId,
    kind: "post_pending",
    title: "Nuovo contenuto da approvare",
    body: captionText.slice(0, 120) || "Apri il portale per revisionare.",
    href: `/app/posts/${postId}`,
  }).catch(() => {});

  void notifyAdminUsers({
    kind: "post_created",
    title: `Nuovo post in coda · ${client.companyName}`,
    body: `${platform} — in attesa approvazione cliente`,
    href: `/admin/posts/${postId}`,
  }).catch(() => {});

  revalidatePath("/app");
  redirect("/admin/posts");
}
