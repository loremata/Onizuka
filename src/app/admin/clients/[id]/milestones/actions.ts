"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type MilestoneActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function createClientMilestone(
  clientId: string,
  _prev: MilestoneActionResult,
  formData: FormData
): Promise<MilestoneActionResult> {
  const session = await ensureAdmin();
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const targetRaw = (formData.get("targetDate") as string)?.trim();
  const visible = formData.get("visibleToClient") === "on";

  if (!title) return { error: "Titolo obbligatorio." };
  const targetDate = targetRaw ? new Date(targetRaw) : null;
  if (targetRaw && targetDate && Number.isNaN(targetDate.getTime())) {
    return { error: "Data non valida." };
  }

  const maxOrder = await prisma.clientMilestone.aggregate({
    where: { clientId },
    _max: { sortOrder: true },
  });

  await prisma.clientMilestone.create({
    data: {
      clientId,
      ownerUserId: session.user.id,
      title,
      description,
      targetDate,
      visibleToClient: visible,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/app/projects");
  return null;
}

export async function toggleMilestoneComplete(milestoneId: string, clientId: string): Promise<MilestoneActionResult> {
  await ensureAdmin();
  const m = await prisma.clientMilestone.findFirst({ where: { id: milestoneId, clientId } });
  if (!m) return { error: "Milestone non trovata." };

  await prisma.clientMilestone.update({
    where: { id: milestoneId },
    data: { completedAt: m.completedAt ? null : new Date() },
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/app/projects");
  return null;
}

export async function deleteClientMilestone(milestoneId: string, clientId: string): Promise<MilestoneActionResult> {
  await ensureAdmin();
  await prisma.clientMilestone.deleteMany({ where: { id: milestoneId, clientId } });
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/app/projects");
  return null;
}
