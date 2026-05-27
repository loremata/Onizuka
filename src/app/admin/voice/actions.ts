"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parseVoiceTranscript } from "@/lib/voice-intent";
import { evaluateVoiceAutonomy } from "@/lib/voice-autonomy-policy";
import { captureVoiceMemory } from "@/lib/voice-memory-capture";

export type VoiceActionResult =
  | { error: string }
  | { ok: true; message: string; href?: string }
  | null;

export async function executeVoiceCommand(
  _prev: VoiceActionResult,
  formData: FormData
): Promise<VoiceActionResult> {
  const session = await requireAdminArea();
  const transcript = (formData.get("transcript") as string)?.trim();
  if (!transcript) return { error: "Nessun testo riconosciuto." };

  const autonomy = evaluateVoiceAutonomy(transcript);
  if (!autonomy.allowed) {
    return { error: autonomy.reason };
  }

  const intent = parseVoiceTranscript(transcript);

  if (intent.kind === "navigate") {
    redirect(intent.href);
  }

  if (intent.kind === "status") {
    const openStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const;
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const [dueToday, overdue, pendingReach] = await Promise.all([
      prisma.flowTask.count({
        where: {
          ownerUserId: session.user.id,
          status: { in: [...openStatuses] },
          dueDate: { gte: now, lte: end },
        },
      }),
      prisma.flowTask.count({
        where: {
          ownerUserId: session.user.id,
          status: { in: [...openStatuses] },
          dueDate: { lt: now },
        },
      }),
      prisma.outreachDraft.count({
        where: { ownerUserId: session.user.id, status: "PENDING_APPROVAL" },
      }),
    ]);

    return {
      ok: true,
      message: `Oggi: ${dueToday} task in scadenza, ${overdue} in ritardo, ${pendingReach} bozze Reach da approvare.`,
      href: "/admin",
    };
  }

  if (intent.kind === "memory") {
    const saved = await captureVoiceMemory(session.user.id, intent.content);
    revalidatePath("/admin/memory");
    return {
      ok: true,
      message: `Memoria salvata: «${saved.title}»`,
      href: `/admin/memory/${saved.id}/edit`,
    };
  }

  if (intent.kind === "completeTask") {
    const q = intent.query.toLowerCase();
    const task = await prisma.flowTask.findFirst({
      where: {
        ownerUserId: session.user.id,
        status: { in: ["TODO", "IN_PROGRESS", "WAITING"] },
        title: { contains: q, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!task) {
      return { error: `Nessun task aperto trovato per «${intent.query}».` };
    }
    await prisma.flowTask.update({
      where: { id: task.id },
      data: { status: "DONE" },
    });
    revalidatePath("/admin/flow");
    revalidatePath("/admin");
    return { ok: true, message: `Task completato: «${task.title}»`, href: "/admin/flow" };
  }

  if (intent.kind === "task") {
    await prisma.flowTask.create({
      data: {
        title: intent.title,
        ownerUserId: session.user.id,
        source: "voice",
        priority: "MEDIUM",
        status: "TODO",
      },
    });
    revalidatePath("/admin/flow");
    revalidatePath("/admin");
    const note =
      autonomy.risk === "medium" ? ` (${autonomy.reason})` : "";
    return { ok: true, message: `Task creato: «${intent.title}»${note}` };
  }

  return { error: "Comando non compreso. Prova: «ricordami di chiamare …» o «memorizza …»." };
}
