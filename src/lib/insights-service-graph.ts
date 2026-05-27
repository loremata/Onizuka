import { prisma } from "@/lib/prisma";
import { seedCommercialCatalog } from "@/lib/commercial-catalog-seed";

export type ClientUpsellRow = {
  clientId: string;
  companyName: string;
  missingCount: number;
};

/** Clienti con più servizi catalogo non ancora attivi (top cross-sell). */
export async function loadTopClientsByServiceGaps(limit = 8): Promise<ClientUpsellRow[]> {
  await seedCommercialCatalog();

  const [clients, catalogCount] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
      take: 200,
    }),
    prisma.commercialService.count(),
  ]);
  if (catalogCount === 0) return [];

  const rows: ClientUpsellRow[] = [];
  for (const c of clients) {
    const active = await prisma.clientCommercialService.count({
      where: { clientId: c.id, active: true },
    });
    const missing = Math.max(0, catalogCount - active);
    if (missing >= 2) {
      rows.push({ clientId: c.id, companyName: c.companyName, missingCount: missing });
    }
  }

  return rows.sort((a, b) => b.missingCount - a.missingCount).slice(0, limit);
}
