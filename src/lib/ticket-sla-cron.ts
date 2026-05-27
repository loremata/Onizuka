import { prisma } from "@/lib/prisma";
import { notifyAdminUsers } from "@/lib/user-notifications";

/** Segna SLA breach e notifica admin per ticket OPEN/IN_PROGRESS scaduti. */
export async function runTicketSlaBreachCheck(): Promise<{ breached: number }> {
  if (process.env.TICKET_SLA_CRON === "0") return { breached: 0 };

  const now = new Date();
  const due = await prisma.clientTicket.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      slaDueAt: { lt: now },
      slaBreachedAt: null,
    },
    include: { client: { select: { companyName: true } } },
    take: 50,
  });

  for (const t of due) {
    await prisma.clientTicket.update({
      where: { id: t.id },
      data: { slaBreachedAt: now },
    });
    void notifyAdminUsers({
      kind: "ticket_sla_breach",
      title: `SLA ticket scaduto · ${t.client.companyName}`,
      body: t.title,
      href: `/admin/client-portal/tickets`,
    }).catch(() => {});
  }

  return { breached: due.length };
}
