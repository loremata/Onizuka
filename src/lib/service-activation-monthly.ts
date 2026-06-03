import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";

export type ServiceActivationMonthCard = {
  serviceName: string;
  category: string;
  brandName: string | null;
  total: number;
};

function monthRange(year: number, month1Based: number): { start: Date; end: Date } {
  const start = new Date(year, month1Based - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month1Based, 1, 0, 0, 0, 0);
  return { start, end };
}

const categoryLabel: Record<string, string> = {
  SOCIAL: "Social",
  WEB: "Web",
  ADVERTISING: "Advertising",
  SEO: "SEO",
  BRANDING: "Branding",
  CONSULTING: "Consulenza",
  OTHER: "Altro",
};

export async function getServiceActivationMonthlyReport(
  ownerUserId: string,
  year: number,
  month1Based: number
): Promise<{ monthLabel: string; cards: ServiceActivationMonthCard[] }> {
  const { start, end } = monthRange(year, month1Based);
  const monthLabel = dateTimeFormatIt({ month: "long", year: "numeric" }).format(start);

  const [catalog, activations] = await Promise.all([
    prisma.commercialService.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { ecosystemBrand: { select: { name: true } } },
    }),
    prisma.clientCommercialService.findMany({
      where: {
        active: true,
        since: { gte: start, lt: end },
        client: {
          OR: [
            { convertedFromLead: { ownerUserId } },
            { opportunities: { some: { ownerUserId } } },
          ],
        },
      },
      include: {
        commercialService: {
          include: { ecosystemBrand: { select: { name: true } } },
        },
      },
    }),
  ]);

  const countByServiceId = new Map<string, number>();
  for (const a of activations) {
    countByServiceId.set(a.commercialServiceId, (countByServiceId.get(a.commercialServiceId) ?? 0) + 1);
  }

  const cards: ServiceActivationMonthCard[] = catalog.map((s) => ({
    serviceName: s.name,
    category: categoryLabel[s.category] ?? s.category,
    brandName: s.ecosystemBrand?.name ?? null,
    total: countByServiceId.get(s.id) ?? 0,
  }));

  return { monthLabel, cards: cards.sort((a, b) => b.total - a.total || a.serviceName.localeCompare(b.serviceName, "it")) };
}
