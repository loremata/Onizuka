"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type OnboardingActionResult = { error: string } | null;

async function ensureAdmin() {
  return requireAdminArea();
}

export async function toggleOnboardingItem(
  itemId: string,
  clientId: string
): Promise<void> {
  await ensureAdmin();
  const row = await prisma.clientOnboardingItem.findUnique({
    where: { id: itemId },
    select: { status: true },
  });
  if (!row) return;
  const done = row.status === "done";
  await prisma.clientOnboardingItem.update({
    where: { id: itemId },
    data: {
      status: done ? "pending" : "done",
      completedAt: done ? null : new Date(),
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createOnboardingItem(
  clientId: string,
  _prev: OnboardingActionResult,
  formData: FormData
): Promise<OnboardingActionResult> {
  const session = await ensureAdmin();
  const label = (formData.get("label") as string)?.trim();
  if (!label) return { error: "Etichetta obbligatoria." };

  const maxOrder = await prisma.clientOnboardingItem.aggregate({
    where: { clientId },
    _max: { sortOrder: true },
  });

  await prisma.clientOnboardingItem.create({
    data: {
      clientId,
      ownerUserId: session.user.id,
      label,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
  return null;
}

export async function deleteOnboardingItem(itemId: string, clientId: string): Promise<void> {
  await ensureAdmin();
  await prisma.clientOnboardingItem.delete({ where: { id: itemId } });
  revalidatePath(`/admin/clients/${clientId}`);
}
