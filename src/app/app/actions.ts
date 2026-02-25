"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyStatusChange } from "@/lib/webhook";

type ActionResult = { error: string } | null;

async function ensureClientWithId() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "CLIENT" || !session.user.clientId) return null;
  return session;
}

export async function approvePost(
  postId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureClientWithId();
  if (!session) return { error: "Unauthorized." };

  const post = await prisma.postItem.findFirst({
    where: { id: postId, clientId: session.user.clientId! },
  });
  if (!post) return { error: "Post not found." };

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
              userId: session.user.id,
              body,
            },
          }),
        ]
      : []),
  ]);

  await notifyStatusChange(postId);

  revalidatePath("/app");
  revalidatePath(`/app/posts/${postId}`);
  return null;
}

export async function requestChanges(
  postId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureClientWithId();
  if (!session) return { error: "Unauthorized." };

  const post = await prisma.postItem.findFirst({
    where: { id: postId, clientId: session.user.clientId! },
  });
  if (!post) return { error: "Post not found." };

  const body = (formData.get("comment") as string)?.trim();
  if (!body) return { error: "Please add a comment explaining what changes you need." };

  await prisma.$transaction([
    prisma.postItem.update({
      where: { id: postId },
      data: { status: "NEEDS_REVISION" },
    }),
    prisma.comment.create({
      data: {
        postItemId: postId,
        userId: session.user.id,
        body,
      },
    }),
  ]);

  await notifyStatusChange(postId);

  revalidatePath("/app");
  revalidatePath(`/app/posts/${postId}`);
  return null;
}
