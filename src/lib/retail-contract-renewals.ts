import { prisma } from "@/lib/prisma";

export type RetailRenewalRow = {
  id: string;
  clientId: string;
  clientName: string;
  label: string;
  kind: string;
  monthlyEur: number;
  renewalDate: Date;
  daysUntil: number;
  href: string;
};

export async function loadUpcomingRetailRenewals(
  ownerUserId: string,
  withinDays = 60
): Promise<RetailRenewalRow[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.clientRetailContract.findMany({
    where: {
      ownerUserId,
      status: "ACTIVE",
      renewalDate: { gte: now, lte: until },
    },
    orderBy: { renewalDate: "asc" },
    take: 50,
    include: { client: { select: { companyName: true } } },
  });

  return rows
    .filter((r) => r.renewalDate)
    .map((r) => {
      const renewalDate = r.renewalDate!;
      const daysUntil = Math.ceil((renewalDate.getTime() - now.getTime()) / (86400000));
      return {
        id: r.id,
        clientId: r.clientId,
        clientName: r.client.companyName,
        label: r.label,
        kind: r.kind,
        monthlyEur: Number(r.monthlyEur.toString()),
        renewalDate,
        daysUntil,
        href: `/admin/clients/${r.clientId}`,
      };
    });
}
