import { prisma } from "@/lib/prisma";

export type UpcomingRenewalRow = {
  id: string;
  label: string;
  amountEur: number;
  renewalDate: Date;
  clientName: string | null;
};

/** Entrate ricorrenti con data rinnovo nei prossimi N giorni. */
export async function loadUpcomingFinanceRenewals(
  ownerUserId: string,
  withinDays = 60
): Promise<UpcomingRenewalRow[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.financeEntry.findMany({
    where: {
      ownerUserId,
      type: "INCOME",
      recurringMonthly: true,
      renewalDate: { gte: now, lte: until },
    },
    orderBy: { renewalDate: "asc" },
    take: 40,
    select: {
      id: true,
      label: true,
      amountEur: true,
      renewalDate: true,
      client: { select: { companyName: true } },
    },
  });

  return rows
    .filter((r) => r.renewalDate != null)
    .map((r) => ({
      id: r.id,
      label: r.label,
      amountEur: Number(r.amountEur.toString()),
      renewalDate: r.renewalDate!,
      clientName: r.client?.companyName ?? null,
    }));
}
