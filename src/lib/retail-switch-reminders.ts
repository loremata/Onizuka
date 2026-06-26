import { prisma } from "@/lib/prisma";

/**
 * Reminder "cambio compagnia": contratti retail per cui è arrivato (o è vicino)
 * il momento di riproporre un cambio operatore — così si ri-guadagna sullo stesso
 * cliente. Basato su `switchReminderAt` (= signedAt + switchAfterMonths).
 */
export type RetailSwitchRow = {
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  kind: string;
  operator: string | null;
  monthlyEur: number;
  switchReminderAt: Date;
  daysUntil: number; // <= 0 = già proponibile
  due: boolean;
  href: string;
};

export async function loadUpcomingRetailSwitchReminders(
  ownerUserId: string,
  withinDays = 90,
): Promise<RetailSwitchRow[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.clientRetailContract.findMany({
    where: {
      ownerUserId,
      status: "ACTIVE",
      // include anche gli scaduti (già proponibili): nessun lower bound.
      switchReminderAt: { not: null, lte: until },
    },
    orderBy: { switchReminderAt: "asc" },
    take: 80,
    include: { client: { select: { companyName: true } } },
  });

  return rows
    .filter((r) => r.switchReminderAt)
    .map((r) => {
      const switchReminderAt = r.switchReminderAt!;
      const daysUntil = Math.ceil((switchReminderAt.getTime() - now.getTime()) / 86400000);
      return {
        id: r.id,
        clientId: r.clientId,
        clientName: r.client.companyName,
        label: r.label,
        kind: r.kind,
        operator: r.operator ?? null,
        monthlyEur: Number(r.monthlyEur.toString()),
        switchReminderAt,
        daysUntil,
        due: daysUntil <= 0,
        href: `/admin/clients/${r.clientId}`,
      };
    });
}
