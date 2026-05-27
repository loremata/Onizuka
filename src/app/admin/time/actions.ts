"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { isFullAdmin } from "@/lib/auth-roles";
import { prisma } from "@/lib/prisma";
import {
  canApproveTimeEntryClient,
  canApproveTimeEntryProject,
  canFirstApproveTimeEntries,
} from "@/lib/time-approver";

export type TimeEntryResult = { error: string } | null;

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : null;
}

export async function createTimeEntry(_prev: TimeEntryResult, formData: FormData): Promise<TimeEntryResult> {
  const session = await requireAdminArea();
  const description = optionalString(formData.get("description"));
  if (!description) return { error: "Descrizione obbligatoria." };

  const minutesRaw = Number(formData.get("minutes"));
  if (!Number.isFinite(minutesRaw) || minutesRaw < 1 || minutesRaw > 24 * 60) {
    return { error: "Minuti non validi (1–1440)." };
  }

  const clientId = optionalString(formData.get("clientId"));
  const workedAtRaw = optionalString(formData.get("workedAt"));
  const workedAt = workedAtRaw ? new Date(workedAtRaw) : new Date();
  if (workedAtRaw && Number.isNaN(workedAt.getTime())) return { error: "Data non valida." };

  const billable = (formData.get("billable") as string) !== "false";
  const projectCode = optionalString(formData.get("projectCode"))?.slice(0, 64) ?? null;

  const rateRaw = optionalString(formData.get("hourlyRateEur"));
  let hourlyRateEur: number | null = null;
  if (rateRaw) {
    const n = Number(rateRaw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 9999) return { error: "Tariffa oraria non valida (0–9999)." };
    hourlyRateEur = n;
  }

  if (clientId) {
    const ok = await prisma.client.findFirst({ where: { id: clientId }, select: { id: true } });
    if (!ok) return { error: "Cliente non trovato." };
  }

  await prisma.timeEntry.create({
    data: {
      ownerUserId: session.user.id,
      description,
      minutes: Math.round(minutesRaw),
      workedAt,
      billable,
      projectCode,
      hourlyRateEur: hourlyRateEur ?? undefined,
      ...(clientId ? { clientId } : {}),
    },
  });

  revalidatePath("/admin/time");
  return null;
}

export async function approveTimeEntry(entryId: string): Promise<TimeEntryResult> {
  const session = await requireAdminArea();
  const approver = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      canApproveTimeEntries: true,
      timeApproverProjectCodes: true,
      timeApproverClientIds: true,
    },
  });
  if (!approver) return { error: "Utente non trovato." };

  const row = await prisma.timeEntry.findFirst({ where: { id: entryId } });
  if (!row) return { error: "Voce non trovata." };

  if (!row.approvedAt) {
    if (!canFirstApproveTimeEntries(approver.role, approver.canApproveTimeEntries)) {
      return { error: "Non hai permesso di approvare ore (1/2). Chiedi all'admin di abilitare «Approvazione ore»." };
    }
    if (!isFullAdmin(approver.role)) {
      if (!canApproveTimeEntryProject(row.projectCode, approver.timeApproverProjectCodes)) {
        return { error: "Non autorizzato per questa commessa (projectCode)." };
      }
      if (!canApproveTimeEntryClient(row.clientId, approver.timeApproverClientIds)) {
        return { error: "Non autorizzato per questo cliente." };
      }
    }
    await prisma.timeEntry.update({
      where: { id: entryId },
      data: { approvedAt: new Date(), approvedByUserId: session.user.id },
    });
    revalidatePath("/admin/time");
    return null;
  }

  if (row.secondApprovedAt) {
    return { error: "Voce già con doppia approvazione." };
  }

  if (!isFullAdmin(session.user.role)) {
    return { error: "Solo amministratori possono eseguire la seconda approvazione (2/2)." };
  }

  if (row.approvedByUserId === session.user.id) {
    return { error: "La seconda approvazione deve essere di un altro amministratore (four-eyes)." };
  }

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { secondApprovedAt: new Date(), secondApprovedByUserId: session.user.id },
  });

  revalidatePath("/admin/time");
  return null;
}

export async function deleteTimeEntry(id: string): Promise<TimeEntryResult> {
  const session = await requireAdminArea();
  const row = await prisma.timeEntry.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!row) return { error: "Voce non trovata." };
  await prisma.timeEntry.delete({ where: { id } });
  revalidatePath("/admin/time");
  return null;
}
