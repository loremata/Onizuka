"use server";

import { revalidatePath } from "next/cache";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { notifyAdminUsers } from "@/lib/user-notifications";
import { notifyStatusChange } from "@/lib/webhook";

type ActionResult = { error: string } | null;

export async function approvePost(
  postId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAppClientContext();

  const post = await prisma.postItem.findFirst({
    where: { id: postId, clientId: ctx.clientId },
    include: { client: { select: { companyName: true } } },
  });
  if (!post) return { error: "Post non trovato." };

  const body = (formData.get("comment") as string)?.trim();

  await prisma.$transaction([
    prisma.postItem.update({
      where: { id: postId },
      data: { status: "APPROVED" },
    }),
    ...(body
      ? [
          prisma.comment.create({
            data: {
              postItemId: postId,
              userId: ctx.userId,
              body,
            },
          }),
        ]
      : []),
  ]);

  await notifyStatusChange(postId);

  void notifyAdminUsers({
    kind: "post_approved",
    title: `Post approvato · ${post.client.companyName}`,
    body: post.captionText.slice(0, 120) || undefined,
    href: `/admin/posts/${postId}`,
  }).catch(() => {});

  void logAuditEvent({
    actorUserId: ctx.userId,
    action: ctx.isAdminPreview ? "client_preview.post_approve" : "post.approved_client",
    entityType: "post",
    entityId: postId,
    summary: ctx.isAdminPreview
      ? `Approvazione post in anteprima admin · ${post.client.companyName}`
      : `Approvazione cliente · ${post.client.companyName}`,
    metadata: { clientId: ctx.clientId, preview: ctx.isAdminPreview },
  });

  revalidatePath("/app");
  revalidatePath(`/app/posts/${postId}`);
  revalidatePath("/admin/posts");
  return null;
}

export async function requestChanges(
  postId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const ctx = await requireAppClientContext();
  const post = await prisma.postItem.findFirst({
    where: { id: postId, clientId: ctx.clientId },
    include: { client: { select: { companyName: true } } },
  });
  if (!post) return { error: "Post non trovato." };

  const body = (formData.get("comment") as string)?.trim();
  if (!body) return { error: "Aggiungi un commento che spieghi quali modifiche servono." };

  await prisma.$transaction([
    prisma.postItem.update({
      where: { id: postId },
      data: { status: "NEEDS_REVISION" },
    }),
    prisma.comment.create({
      data: {
        postItemId: postId,
        userId: ctx.userId,
        body,
      },
    }),
  ]);

  await notifyStatusChange(postId);

  if (ctx.isAdminPreview) {
    void logAuditEvent({
      actorUserId: ctx.userId,
      action: "client_preview.post_revision",
      entityType: "post",
      entityId: postId,
      summary: `Revisione post in anteprima admin · ${post.client.companyName}`,
      metadata: { clientId: ctx.clientId, comment: body.slice(0, 200) },
    });
  } else {
    void notifyAdminUsers({
      kind: "post_revision",
      title: `Revisione richiesta · ${post.client.companyName}`,
      body: body.slice(0, 120),
      href: `/admin/posts/${postId}`,
    }).catch(() => {});

    void logAuditEvent({
      actorUserId: ctx.userId,
      action: "post.revision_client",
      entityType: "post",
      entityId: postId,
      summary: `Revisione richiesta dal cliente · ${post.client.companyName}`,
      metadata: { clientId: ctx.clientId },
    });
  }

  revalidatePath("/app");
  revalidatePath(`/app/posts/${postId}`);
  revalidatePath("/admin/posts");
  return null;
}
