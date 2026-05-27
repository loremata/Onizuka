"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { FlowTaskPriority, FlowTaskStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { parseDateTimeLocalInIanaZone, resolveDueInputIanaZone, resolveRecapDayBounds } from "@/lib/day-bounds";
import { notifyFlowTaskReminderIfNeeded } from "@/lib/flow-due-notifications";
import { syncFlowTaskToGoogleCalendar } from "@/lib/flow-google-calendar-sync";
import { prisma } from "@/lib/prisma";

export type FlowActionResult = { error: string } | null;

const STATUSES: FlowTaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "WAITING",
  "DONE",
  "CANCELLED",
];

const PRIORITIES: FlowTaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function parseStatus(raw: string | null): FlowTaskStatus | null {
  if (!raw) return null;
  return STATUSES.includes(raw as FlowTaskStatus) ? (raw as FlowTaskStatus) : null;
}

function parsePriority(raw: string | null): FlowTaskPriority {
  if (!raw || !PRIORITIES.includes(raw as FlowTaskPriority)) return "MEDIUM";
  return raw as FlowTaskPriority;
}

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function createFlowTask(
  _prev: FlowActionResult,
  formData: FormData
): Promise<FlowActionResult> {
  const session = await ensureAdmin();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || undefined;
  const priority = parsePriority((formData.get("priority") as string) ?? null);
  const status = parseStatus((formData.get("status") as string) ?? null) ?? "TODO";
  const dueRaw = (formData.get("dueDate") as string)?.trim();
  const relatedClientId = (formData.get("relatedClientId") as string)?.trim() || null;

  if (!title) return { error: "Il titolo è obbligatorio." };

  let dueDate: Date | undefined;
  if (dueRaw) {
    const parseZone = resolveDueInputIanaZone(session.user.timeZone);
    if (parseZone) {
      const parsed = parseDateTimeLocalInIanaZone(dueRaw, parseZone);
      if (!parsed) return { error: "Data di scadenza non valida per il fuso configurato (es. ora inesistente)." };
      dueDate = parsed;
    } else {
      const d = new Date(dueRaw);
      if (Number.isNaN(d.getTime())) return { error: "Data di scadenza non valida." };
      dueDate = d;
    }
  }

  if (relatedClientId) {
    const client = await prisma.client.findUnique({ where: { id: relatedClientId } });
    if (!client) return { error: "Cliente non trovato." };
  }

  try {
    const created = await prisma.flowTask.create({
      data: {
        title,
        description,
        priority,
        status,
        dueDate,
        source: "manual",
        ownerUserId: session.user.id,
        relatedClientId,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        ownerUserId: true,
        client: { select: { companyName: true } },
      },
    });
    if (dueDate) {
      const { start, end } = resolveRecapDayBounds({ userTimeZone: session.user.timeZone });
      void notifyFlowTaskReminderIfNeeded(created, start, end).catch(() => {});
      void syncFlowTaskToGoogleCalendar(session.user.id, {
        taskId: created.id,
        title: created.title,
        dueDate,
        clientName: created.client?.companyName,
      });
    }
  } catch (e) {
    console.error(e);
    return { error: "Creazione task non riuscita." };
  }

  revalidatePath("/admin/flow");
  revalidatePath("/admin");
  revalidatePath("/admin/search");
  redirect("/admin/flow");
}

export async function updateFlowTaskStatus(
  taskId: string,
  _prev: FlowActionResult,
  formData: FormData
): Promise<FlowActionResult> {
  const session = await ensureAdmin();

  const status = parseStatus((formData.get("status") as string) ?? null);
  if (!status) return { error: "Stato non valido." };

  const task = await prisma.flowTask.findFirst({
    where: { id: taskId, ownerUserId: session.user.id },
  });
  if (!task) return { error: "Task non trovato." };
  if (task.status === status) return null;

  try {
    await prisma.flowTask.update({
      where: { id: taskId },
      data: { status },
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento non riuscito." };
  }

  revalidatePath("/admin/flow");
  revalidatePath("/admin");
  revalidatePath("/admin/search");
  return null;
}

export async function updateFlowTaskDueDate(
  taskId: string,
  _prev: FlowActionResult,
  formData: FormData
): Promise<FlowActionResult> {
  const session = await ensureAdmin();

  const dueRaw = (formData.get("dueDate") as string)?.trim();
  let dueDate: Date | null = null;

  if (dueRaw) {
    const parseZone = resolveDueInputIanaZone(session.user.timeZone);
    if (parseZone) {
      const parsed = parseDateTimeLocalInIanaZone(dueRaw, parseZone);
      if (!parsed) return { error: "Data di scadenza non valida per il fuso configurato." };
      dueDate = parsed;
    } else {
      const d = new Date(dueRaw);
      if (Number.isNaN(d.getTime())) return { error: "Data di scadenza non valida." };
      dueDate = d;
    }
  }

  const task = await prisma.flowTask.findFirst({
    where: { id: taskId, ownerUserId: session.user.id },
    select: {
      id: true,
      title: true,
      dueDate: true,
      ownerUserId: true,
      client: { select: { companyName: true } },
    },
  });
  if (!task) return { error: "Task non trovato." };

  try {
    await prisma.flowTask.update({
      where: { id: taskId },
      data: { dueDate },
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento scadenza non riuscito." };
  }

  if (dueDate) {
    const { start, end } = resolveRecapDayBounds({ userTimeZone: session.user.timeZone });
    void notifyFlowTaskReminderIfNeeded({ ...task, dueDate }, start, end).catch(() => {});
    void syncFlowTaskToGoogleCalendar(session.user.id, {
      taskId: task.id,
      title: task.title,
      dueDate,
      clientName: task.client?.companyName,
    });
  }

  revalidatePath("/admin/flow");
  revalidatePath("/admin");
  revalidatePath("/admin/search");
  return null;
}

export async function deleteFlowTask(taskId: string): Promise<FlowActionResult> {
  const session = await ensureAdmin();

  const task = await prisma.flowTask.findFirst({
    where: { id: taskId, ownerUserId: session.user.id },
    select: { id: true, title: true },
  });
  if (!task) return { error: "Task non trovato." };

  try {
    await prisma.flowTask.delete({ where: { id: taskId } });
  } catch (e) {
    console.error(e);
    return { error: "Eliminazione non riuscita." };
  }

  const { logAuditEvent } = await import("@/lib/admin-audit-log");
  void logAuditEvent({
    actorUserId: session.user.id,
    action: "flow.delete",
    entityType: "flow",
    entityId: taskId,
    summary: `Task eliminato · ${task.title}`,
  });

  revalidatePath("/admin/flow");
  revalidatePath("/admin");
  revalidatePath("/admin/search");
  return null;
}
