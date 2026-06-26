import { prisma } from "@/lib/prisma";
import { ensureCommercialCatalogSeeded } from "@/lib/commercial-catalog-seed";

export type ServiceGraphSuggestion = {
  serviceId: string;
  serviceName: string;
  brandName: string;
  reason: string;
};

/** Suggerimenti cross-sell dal catalogo non ancora attivi sul cliente. */
export async function loadServiceGraphSuggestions(
  clientId: string,
  limit = 5
): Promise<ServiceGraphSuggestion[]> {
  await ensureCommercialCatalogSeeded();

  const [active, catalog] = await Promise.all([
    prisma.clientCommercialService.findMany({
      where: { clientId, active: true },
      select: { commercialServiceId: true },
    }),
    prisma.commercialService.findMany({
      include: { ecosystemBrand: { select: { name: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const activeIds = new Set(active.map((a) => a.commercialServiceId));
  const out: ServiceGraphSuggestion[] = [];

  for (const svc of catalog) {
    if (activeIds.has(svc.id)) continue;
    out.push({
      serviceId: svc.id,
      serviceName: svc.name,
      brandName: svc.ecosystemBrand?.name ?? "—",
      reason: `Servizio non attivo — compatibile con espansione ${svc.category}`,
    });
    if (out.length >= limit) break;
  }

  return out;
}
