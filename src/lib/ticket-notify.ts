import { prisma } from "@/lib/prisma";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp-send";
import type { TicketStatus } from "@prisma/client";

const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Aperto",
  IN_PROGRESS: "In lavorazione",
  RESOLVED: "Risolto",
  CLOSED: "Chiuso",
};

export function ticketNotifyEnabled(): boolean {
  if (process.env.TICKET_NOTIFY_EMAIL === "0") return false;
  return isSmtpConfigured();
}

export async function notifyClientTicketUpdate(params: {
  ticketId: string;
  title: string;
  status: TicketStatus;
  message: string | null;
  clientId: string;
}): Promise<void> {
  if (!ticketNotifyEnabled()) return;

  const users = await prisma.user.findMany({
    where: { clientId: params.clientId, role: "CLIENT" },
    select: { email: true, name: true },
  });

  const recipients = users.map((u) => u.email).filter(Boolean);
  if (recipients.length === 0) {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: { contactEmail: true, companyName: true },
    });
    if (client?.contactEmail) recipients.push(client.contactEmail);
  }

  if (recipients.length === 0) return;

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const bodyLines = [
    `Ciao,`,
    ``,
    `Il team ha aggiornato il ticket «${params.title}».`,
    `Stato: ${statusLabel[params.status]}.`,
    params.message ? `Messaggio: ${params.message}` : "",
    ``,
    `Vedi i dettagli: ${baseUrl}/app/tickets`,
    ``,
    `— Onizuka`,
  ].filter((l) => l !== undefined);

  const text = bodyLines.join("\n");

  for (const to of recipients) {
    await sendEmailViaSmtp({
      to,
      subject: `[Onizuka] Aggiornamento ticket: ${params.title}`,
      text,
    });
  }
}
