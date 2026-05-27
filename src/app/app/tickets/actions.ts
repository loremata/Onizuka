"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { requireAppClientContext } from "@/lib/app-client-session";
import { prisma } from "@/lib/prisma";
import { saveTicketAttachments } from "@/lib/ticket-attachments";
import { runTicketCreatedAutomationRules } from "@/lib/automation-rules-run";
import { defaultTicketSlaDueAt } from "@/lib/ticket-sla";
import { notifyAdminUsers } from "@/lib/user-notifications";

type ActionResult = { error: string } | null;

export async function createClientTicket(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const ctx = await requireAppClientContext();

  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  if (!title || title.length < 3) return { error: "Titolo troppo corto." };
  if (!body || body.length < 10) return { error: "Descrivi la richiesta (min 10 caratteri)." };

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  const clientId = ctx.clientId;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { ticketSlaHours: true },
  });

  const ticket = await prisma.clientTicket.create({
    data: {
      clientId,
      title,
      body,
      createdByUserId: ctx.userId,
      clientReadAt: new Date(),
      slaDueAt: defaultTicketSlaDueAt(new Date(), client?.ticketSlaHours),
    },
  });

  if (ctx.isAdminPreview) {
    void logAuditEvent({
      actorUserId: ctx.userId,
      action: "client_preview.ticket_create",
      entityType: "ticket",
      entityId: ticket.id,
      summary: `Ticket creato in anteprima admin: ${title}`,
      metadata: { clientId },
    });
  }

  const attachError = await saveTicketAttachments({
    ticketId: ticket.id,
    clientId,
    files,
    uploadedByUserId: ctx.userId,
  });
  if (attachError) {
    await prisma.clientTicket.delete({ where: { id: ticket.id } });
    return { error: attachError };
  }

  void notifyAdminUsers({
    kind: "ticket_new",
    title: `Nuovo ticket: ${title}`,
    body: body.slice(0, 160),
    href: "/admin/client-portal/tickets",
  }).catch(() => {});

  void runTicketCreatedAutomationRules(clientId, ticket.id, title).catch(() => {});

  revalidatePath("/app/tickets");
  revalidatePath("/admin/client-portal/tickets");
  return null;
}

export async function markClientTicketsRead(): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) return;
  await markTicketReadInternal(session.user.clientId, null);
  revalidatePath("/app/tickets");
  revalidatePath("/app");
  revalidatePath("/app/dashboard");
}

export async function markTicketRead(ticketId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.clientId) return;

  const ticket = await prisma.clientTicket.findFirst({
    where: { id: ticketId, clientId: session.user.clientId },
    select: { id: true },
  });
  if (!ticket) return;

  await markTicketReadInternal(session.user.clientId, ticketId);
  revalidatePath("/app/tickets");
  revalidatePath("/app");
  revalidatePath("/app/dashboard");
}

async function markTicketReadInternal(clientId: string, ticketId: string | null): Promise<void> {
  const now = new Date();
  const ticketWhere = ticketId ? { id: ticketId, clientId } : { clientId };

  await prisma.$transaction([
    prisma.clientTicket.updateMany({
      where: ticketWhere,
      data: { clientReadAt: now },
    }),
    prisma.clientTicketUpdate.updateMany({
      where: {
        ticket: ticketWhere,
        createdByUserId: { not: null },
        clientReadAt: null,
      },
      data: { clientReadAt: now },
    }),
  ]);
}
