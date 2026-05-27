"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type CommitmentActionResult = { error: string } | null;

async function ensureAdmin() {
  return requireAdminArea();
}

export async function createClientCommitment(
  clientId: string,
  _prev: CommitmentActionResult,
  formData: FormData
): Promise<CommitmentActionResult> {
  const session = await ensureAdmin();
  const title = (formData.get("title") as string)?.trim();
  const ownerName = (formData.get("ownerName") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;
  const dueRaw = (formData.get("dueDate") as string)?.trim();
  if (!title) return { error: "Titolo obbligatorio." };

  let dueDate: Date | null = null;
  if (dueRaw) {
    dueDate = new Date(dueRaw);
    if (Number.isNaN(dueDate.getTime())) return { error: "Data non valida." };
  }

  await prisma.clientCommitment.create({
    data: {
      clientId,
      ownerUserId: session.user.id,
      title,
      ownerName,
      note,
      dueDate,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return null;
}

export async function toggleCommitmentStatus(
  commitmentId: string,
  clientId: string
): Promise<void> {
  await ensureAdmin();
  const row = await prisma.clientCommitment.findUnique({
    where: { id: commitmentId },
    select: { status: true },
  });
  if (!row) return;
  const open = row.status === "open";
  await prisma.clientCommitment.update({
    where: { id: commitmentId },
    data: {
      status: open ? "done" : "open",
      completedAt: open ? new Date() : null,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteClientCommitment(
  commitmentId: string,
  clientId: string
): Promise<void> {
  await ensureAdmin();
  await prisma.clientCommitment.delete({ where: { id: commitmentId } });
  revalidatePath(`/admin/clients/${clientId}`);
}
