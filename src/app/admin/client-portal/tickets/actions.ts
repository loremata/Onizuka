"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-audit-log";
import { saveTicketAttachments } from "@/lib/ticket-attachments";
import { notifyClientTicketUpdate } from "@/lib/ticket-notify";
import { notifyClientUsers } from "@/lib/user-notifications";
import type { TicketStatus } from "@prisma/client";

const VALID: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export async function updateTicketStatus(ticketId: string, statusRaw: string, message?: string) {
  const formData = new FormData();
  formData.set("status", statusRaw);
  if (message) formData.set("message", message);
  return updateTicketReply(ticketId, formData);
}

export async function updateTicketReply(
  ticketId: string,
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return { error: "Non autorizzato" };
  }

  const statusRaw = (formData.get("status") as string) ?? "";
  const status = statusRaw as TicketStatus;
  if (!VALID.includes(status)) {
    return { error: "Stato non valido" };
  }

  const message = (formData.get("message") as string)?.trim();
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);

  const existing = await prisma.clientTicket.findUnique({ where: { id: ticketId } });
  if (!existing) return { error: "Ticket non trovato" };

  const statusChanged = existing.status !== status;
  const hasMessage = Boolean(message);

  if (!statusChanged && !hasMessage && files.length === 0) {
    return { ok: true };
  }

  const updateMessage = hasMessage ? message! : statusChanged ? `Stato aggiornato a ${status}` : null;

  const update = await prisma.$transaction(async (tx) => {
    await tx.clientTicket.update({
      where: { id: ticketId },
      data: { status, clientReadAt: null },
    });
    return tx.clientTicketUpdate.create({
      data: {
        ticketId,
        status: statusChanged ? status : null,
        message: updateMessage,
        createdByUserId: session.user.id,
      },
    });
  });

  if (files.length > 0) {
    const attachError = await saveTicketAttachments({
      ticketId,
      clientId: existing.clientId,
      updateId: update.id,
      files,
      uploadedByUserId: session.user.id,
    });
    if (attachError) return { error: attachError };
  }

  void notifyClientTicketUpdate({
    ticketId,
    title: existing.title,
    status,
    message: updateMessage,
    clientId: existing.clientId,
  }).catch(() => {});

  void notifyClientUsers({
    clientId: existing.clientId,
    kind: "ticket_reply",
    title: `Aggiornamento ticket: ${existing.title}`,
    body: updateMessage ?? `Stato: ${status}`,
    href: "/app/tickets",
  }).catch(() => {});

  void logAdminAction({
    actorUserId: session.user.id,
    action: "ticket.update",
    entityType: "ticket",
    entityId: ticketId,
    summary: `Ticket «${existing.title}» → ${status}`,
    metadata: { statusChanged, hasMessage, attachmentCount: files.length },
  });

  revalidatePath("/admin/client-portal/tickets");
  revalidatePath("/admin/audit");
  revalidatePath("/app/tickets");
  revalidatePath("/app");
  return { ok: true };
}
