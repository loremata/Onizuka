import { prisma } from "@/lib/prisma";
import { ensureCommercialCatalogSeeded } from "@/lib/commercial-catalog-seed";

export type ClientUpsellRow = {
  clientId: string;
  companyName: string;
  missingCount: number;
};

/** Clienti con più servizi catalogo non ancora attivi (top cross-sell). */
export async function loadTopClientsByServiceGaps(limit = 8): Promise<ClientUpsellRow[]> {
  await ensureCommercialCatalogSeeded();

  const [clients, catalogCount] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
      take: 200,
    }),
    prisma.commercialService.count(),
  ]);
  if (catalogCount === 0) return [];

  // Batch: conteggio servizi attivi per cliente in una sola groupBy (prima: N+1, un count per cliente).
  const grouped = await prisma.clientCommercialService.groupBy({
    by: ["clientId"],
    where: { clientId: { in: clients.map((c) => c.id) }, active: true },
    _count: { _all: true },
  });
  const activeByClient = new Map(grouped.map((g) => [g.clientId, g._count._all]));

  const rows: ClientUpsellRow[] = [];
  for (const c of clients) {
    const active = activeByClient.get(c.id) ?? 0;
    const missing = Math.max(0, catalogCount - active);
    if (missing >= 2) {
      rows.push({ clientId: c.id, companyName: c.companyName, missingCount: missing });
    }
  }

  return rows.sort((a, b) => b.missingCount - a.missingCount).slice(0, limit);
}
