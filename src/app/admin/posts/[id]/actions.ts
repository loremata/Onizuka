"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/prisma";
import { notifyClientUsers } from "@/lib/user-notifications";
import { platformLabelIt } from "@/lib/post-ui-labels";

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function setPostPending(postId: string) {
  const session = await ensureAdmin();
  if (!session) return { error: "Non autorizzato." };

  await prisma.postItem.update({
    where: { id: postId },
    data: { status: "PENDING" },
  });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "post.status",
    entityType: "post",
    entityId: postId,
    summary: "Post rimesso in attesa",
    metadata: { status: "PENDING" },
  });

  revalidatePath("/admin/posts");
  revalidatePath("/admin/audit");
  revalidatePath(`/admin/posts/${postId}`);
  return null;
}

export async function releasePostForClientReview(postId: string) {
  const session = await ensureAdmin();
  if (!session) return { error: "Non autorizzato." };

  const post = await prisma.postItem.findUnique({
    where: { id: postId },
    include: { client: { select: { companyName: true } } },
  });
  if (!post) return { error: "Post non trovato." };
  if (post.awaitingClientReview) return { error: "Già in coda approvazione cliente." };

  await prisma.postItem.update({
    where: { id: postId },
    data: { awaitingClientReview: true, status: "PENDING" },
  });

  void notifyClientUsers({
    clientId: post.clientId,
    kind: "post_pending",
    title: "Contenuto pronto da approvare",
    body: `${platformLabelIt[post.platform]} — revisione finale richiesta`,
    href: `/app/posts/${post.id}`,
  }).catch(() => {});

  revalidatePath("/admin/posts");
  revalidatePath("/app");
  revalidatePath(`/admin/posts/${postId}`);
  return null;
}
