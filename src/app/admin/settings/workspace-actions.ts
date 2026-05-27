"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { setActiveWorkspaceCookie } from "@/lib/workspace-scope";
import { prisma } from "@/lib/prisma";

export async function switchWorkspace(workspaceId: string): Promise<{ error?: string }> {
  await requireFullAdmin();
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!ws) return { error: "Workspace non trovato." };
  await setActiveWorkspaceCookie(workspaceId);
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  return {};
}
