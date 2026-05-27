"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminArea } from "@/lib/admin-session";

type ActionResult = { error: string } | null;

export async function updateSequenceStep(
  stepId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAdminArea();

  const step = await prisma.outreachSequenceStep.findFirst({
    where: { id: stepId, sequence: { ownerUserId: session.user.id } },
    select: { id: true, status: true, sequenceId: true },
  });
  if (!step) return { error: "Step non trovato." };
  if (step.status !== "SCHEDULED") {
    return { error: "Solo step programmati sono modificabili." };
  }

  const delayDays = Number((formData.get("delayDays") as string)?.trim());
  const subject = (formData.get("subject") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const subjectAlt = (formData.get("subjectAlt") as string)?.trim() || null;
  const bodyAlt = (formData.get("bodyAlt") as string)?.trim() || null;

  if (Number.isNaN(delayDays) || delayDays < 0) return { error: "Giorni non validi." };
  if (!subject || !body) return { error: "Oggetto e corpo obbligatori." };

  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + delayDays);
  scheduledFor.setHours(9, 0, 0, 0);

  await prisma.outreachSequenceStep.update({
    where: { id: stepId },
    data: { delayDays, subject, subjectAlt, body, bodyAlt, scheduledFor },
  });

  revalidatePath(`/admin/reach/sequences/${step.sequenceId}`);
  revalidatePath("/admin/reach/sequences");
  return null;
}
