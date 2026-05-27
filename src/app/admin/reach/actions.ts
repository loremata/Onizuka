"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import {
  createManualClientOutreachSequence,
  createManualLeadOutreachSequence,
} from "@/lib/outreach-sequence";
import { markOutreachDraftSent } from "@/lib/outreach-sent";
import { applyReachAbWinnerAsDefault, resolveReachAbVariantForSend } from "@/lib/reach-ab-default";
import { hasOutreachAb } from "@/lib/outreach-ab";
import { parseCustomSequenceSteps } from "@/lib/outreach-custom-steps";

type ActionResult = { error: string } | null;

const ensureAdmin = requireAdminArea;

export async function createOutreachDraft(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const session = await ensureAdmin();

  const subject = (formData.get("subject") as string)?.trim();
  const subjectAlt = (formData.get("subjectAlt") as string)?.trim() || null;
  const bodyAlt = (formData.get("bodyAlt") as string)?.trim() || null;
  const body = (formData.get("body") as string)?.trim();
  const clientId = (formData.get("clientId") as string)?.trim() || null;
  const leadId = (formData.get("leadId") as string)?.trim() || null;

  if (!subject || !body) return { error: "Oggetto e corpo obbligatori." };

  await prisma.outreachDraft.create({
    data: {
      ownerUserId: session.user.id,
      subject,
      subjectAlt,
      bodyAlt,
      body,
      clientId: clientId || undefined,
      leadId: leadId || undefined,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/reach");
  return null;
}

export async function submitOutreachForApproval(draftId: string): Promise<ActionResult> {
  const session = await ensureAdmin();

  const draft = await prisma.outreachDraft.findFirst({
    where: { id: draftId, ownerUserId: session.user.id },
  });
  if (!draft) return { error: "Bozza non trovata." };

  await prisma.outreachDraft.update({
    where: { id: draftId },
    data: { status: "PENDING_APPROVAL" },
  });

  revalidatePath("/admin/reach");
  revalidatePath("/admin/approvals");
  return null;
}

export async function approveOutreachDraft(draftId: string): Promise<ActionResult> {
  const session = await ensureAdmin();

  await prisma.outreachDraft.updateMany({
    where: { id: draftId, ownerUserId: session.user.id, status: "PENDING_APPROVAL" },
    data: { status: "APPROVED" },
  });

  revalidatePath("/admin/reach");
  revalidatePath("/admin/approvals");
  return null;
}

export async function markOutreachSent(
  draftId: string,
  abVariant?: "A" | "B"
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const ok = await markOutreachDraftSent(draftId, session.user.id, {
    abVariantSent: abVariant,
  });
  if (!ok) return { error: "Bozza non trovata o già inviata." };

  revalidatePath("/admin/reach");
  revalidatePath("/admin/reach/sequences");
  revalidatePath("/admin/approvals");
  return null;
}

export async function applyReachAbDefaultAction(): Promise<
  { ok: true; variant: string } | { error: string }
> {
  const session = await ensureAdmin();
  const result = await applyReachAbWinnerAsDefault(session.user.id);
  if ("error" in result) return { error: result.error };
  revalidatePath("/admin/reach");
  return { ok: true, variant: result.variant };
}

export async function createOutreachSequence(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const targetType = (formData.get("targetType") as string)?.trim();
  const clientId = (formData.get("clientId") as string)?.trim();
  const leadId = (formData.get("leadId") as string)?.trim();
  const priorityProblem = (formData.get("priorityProblem") as string)?.trim() || null;
  const sequenceMode = (formData.get("sequenceMode") as string)?.trim() || "preset";

  let customTemplates;
  if (sequenceMode === "custom" || sequenceMode === "preset") {
    const parsed = parseCustomSequenceSteps(formData);
    if ("error" in parsed) return { error: parsed.error };
    customTemplates = parsed;
  }

  if (targetType === "lead") {
    if (!leadId) return { error: "Seleziona un lead." };
    try {
      await createManualLeadOutreachSequence({
        ownerUserId: session.user.id,
        leadId,
        priorityProblem,
        templates: customTemplates,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Errore sequenza lead." };
    }
  } else {
    if (!clientId) return { error: "Seleziona un cliente." };
    try {
      await createManualClientOutreachSequence({
        ownerUserId: session.user.id,
        clientId,
        priorityProblem,
        templates: customTemplates,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Errore sequenza cliente." };
    }
  }

  revalidatePath("/admin/reach/sequences");
  revalidatePath("/admin/reach");
  return null;
}

export async function pauseOutreachSequence(sequenceId: string): Promise<ActionResult> {
  const session = await ensureAdmin();
  const updated = await prisma.outreachSequence.updateMany({
    where: { id: sequenceId, ownerUserId: session.user.id, status: "ACTIVE" },
    data: { status: "PAUSED" },
  });
  if (updated.count === 0) return { error: "Sequenza non trovata o non attiva." };
  revalidatePath("/admin/reach/sequences");
  return null;
}

export async function resumeOutreachSequence(sequenceId: string): Promise<ActionResult> {
  const session = await ensureAdmin();
  const updated = await prisma.outreachSequence.updateMany({
    where: { id: sequenceId, ownerUserId: session.user.id, status: "PAUSED" },
    data: { status: "ACTIVE" },
  });
  if (updated.count === 0) return { error: "Sequenza non trovata o non in pausa." };
  revalidatePath("/admin/reach/sequences");
  return null;
}

export async function cancelOutreachSequence(sequenceId: string): Promise<ActionResult> {
  const session = await ensureAdmin();
  const updated = await prisma.outreachSequence.updateMany({
    where: {
      id: sequenceId,
      ownerUserId: session.user.id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
    data: { status: "CANCELLED" },
  });
  if (updated.count === 0) return { error: "Sequenza non trovata." };
  revalidatePath("/admin/reach/sequences");
  revalidatePath("/admin/reach");
  return null;
}
