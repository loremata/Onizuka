import { prisma } from "@/lib/prisma";

export type BrandEconomicsRow = {
  brandSlug: string;
  brandName: string;
  incomeEur: number;
  expenseEur: number;
  marginEur: number;
  entryCount: number;
};

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Economics per brand ecosistema (mese corrente, via servizi collegati). */
export async function loadFinanceByBrand(ownerUserId: string): Promise<BrandEconomicsRow[]> {
  const { start, end } = monthBounds();

  const entries = await prisma.financeEntry.findMany({
    where: {
      ownerUserId,
      status: { in: ["EXPECTED", "RECEIVED", "PAID", "OVERDUE", "PLANNED"] },
      OR: [
        { dueDate: { gte: start, lte: end } },
        { paidAt: { gte: start, lte: end } },
        { AND: [{ dueDate: null }, { createdAt: { gte: start, lte: end } }] },
      ],
    },
    select: {
      type: true,
      amountEur: true,
      client: {
        select: {
          commercialServices: {
            where: { active: true },
            take: 1,
            select: {
              commercialService: {
                select: {
                  ecosystemBrand: { select: { slug: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const brands = await prisma.ecosystemBrand.findMany({
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true },
  });

  const map = new Map<string, BrandEconomicsRow>();
  for (const b of brands) {
    map.set(b.slug, {
      brandSlug: b.slug,
      brandName: b.name,
      incomeEur: 0,
      expenseEur: 0,
      marginEur: 0,
      entryCount: 0,
    });
  }

  const unassigned = "online-station";

  for (const e of entries) {
    const amount = Number(e.amountEur);
    const brand = e.client?.commercialServices?.[0]?.commercialService?.ecosystemBrand;
    const slug = brand?.slug ?? unassigned;
    const row = map.get(slug) ?? {
      brandSlug: slug,
      brandName: brand?.name ?? "Online Station",
      incomeEur: 0,
      expenseEur: 0,
      marginEur: 0,
      entryCount: 0,
    };
    row.entryCount += 1;
    if (e.type === "INCOME") row.incomeEur += amount;
    else row.expenseEur += amount;
    row.marginEur = row.incomeEur - row.expenseEur;
    map.set(slug, row);
  }

  return Array.from(map.values()).filter((r) => r.entryCount > 0 || r.brandSlug !== unassigned);
}
