"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function setPostPending(postId: string) {
  const session = await ensureAdmin();
  if (!session) return { error: "Unauthorized." };

  await prisma.postItem.update({
    where: { id: postId },
    data: { status: "PENDING" },
  });

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${postId}`);
  return null;
}
