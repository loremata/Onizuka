import { prisma } from "@/lib/prisma";

export type RevenueAtRiskItem = {
  clientId: string;
  clientName: string;
  renewalDate: string | null;
  daysToExpiry: number;
  monthlyEur: number;
  overdueFinance: number;
  openTickets: number;
  riskScore: number;
  riskLevel: "high" | "medium" | "low";
  estimatedAtRiskEur: number;
  reason: string;
  href: string;
};

function clamp01(v: number): number {
  if (Number.isNaN(v) || v < 0) return 0;
  return v > 1 ? 1 : v;
}

export async function getRevenueAtRisk(
  ownerUserId: string,
  limit = 15
): Promise<RevenueAtRiskItem[]> {
  const now = Date.now();
  const horizon = new Date(now + 120 * 24 * 60 * 60 * 1000);

  const contracts = await prisma.clientRetailContract.findMany({
    where: {
      ownerUserId,
      status: "ACTIVE",
      renewalDate: { lte: horizon, not: null },
    },
    include: { client: { select: { id: true, companyName: true } } },
    take: 80,
  });

  const items: RevenueAtRiskItem[] = [];

  for (const c of contracts) {
    if (!c.client || !c.renewalDate) continue;
    const daysToExpiry = Math.floor((c.renewalDate.getTime() - now) / (1000 * 60 * 60 * 24));
    if (daysToExpiry > 120) continue;

    const monthlyEur = Number(c.monthlyEur.toString());
    const [overdueFinance, openTickets] = await Promise.all([
      prisma.financeEntry.count({
        where: { clientId: c.clientId, ownerUserId, status: "OVERDUE" },
      }),
      prisma.clientTicket.count({
        where: { clientId: c.clientId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
    ]);

    const expiryRisk = clamp01(1 - Math.max(0, daysToExpiry) / 120);
    const financeRisk = clamp01(overdueFinance / 4);
    const deliveryRisk = clamp01(openTickets / 6);
    const raw = expiryRisk * 0.55 + financeRisk * 0.25 + deliveryRisk * 0.2;
    const riskScore = Math.round(raw * 100);
    const riskLevel = riskScore >= 75 ? "high" : riskScore >= 50 ? "medium" : "low";
    const estimatedAtRiskEur = Math.round(
      monthlyEur * (riskLevel === "high" ? 6 : riskLevel === "medium" ? 3 : 1.5)
    );

    items.push({
      clientId: c.client.id,
      clientName: c.client.companyName,
      renewalDate: c.renewalDate.toISOString().slice(0, 10),
      daysToExpiry,
      monthlyEur,
      overdueFinance,
      openTickets,
      riskScore,
      riskLevel,
      estimatedAtRiskEur,
      reason:
        `Rinnovo ${c.label} tra ${Math.max(daysToExpiry, 0)}g` +
        (overdueFinance ? ` · ${overdueFinance} finance scadute` : "") +
        (openTickets ? ` · ${openTickets} ticket` : ""),
      href: `/admin/clients/${c.client.id}`,
    });
  }

  return items.sort((a, b) => b.riskScore - a.riskScore).slice(0, Math.max(1, limit));
}
