/**
 * Derivazione degli slug servizio POSSEDUTI da un cliente, per il motore campagne.
 *
 * Fonte unica (coerente con `customer-value.ts` e la pipeline):
 *  - `ClientCommercialService` attivi → slug del CommercialService,
 *  - `ClientRetailContract` ACTIVE → slug via `RETAIL_KIND_TO_SLUG`.
 *
 * NB: riusa `RETAIL_KIND_TO_SLUG` da `customer-pipeline.ts` per non divergere
 * dalla mappatura già usata in pipeline/CLV.
 */

import { prisma } from "@/lib/prisma";
import { RETAIL_KIND_TO_SLUG } from "@/lib/customer-pipeline";

/**
 * Costruisce il Set degli slug posseduti a partire da righe già lette dal DB.
 * Modulo puro: comodo per calcolo in batch (evita N+1) e per i test.
 */
export function ownedSlugsFromRows(
  activeCommercialSlugs: string[],
  activeRetailKinds: string[],
): Set<string> {
  const owned = new Set<string>(activeCommercialSlugs);
  for (const kind of activeRetailKinds) {
    const slug = RETAIL_KIND_TO_SLUG[kind];
    if (slug) owned.add(slug);
  }
  return owned;
}

/**
 * Slug servizio posseduti da un singolo cliente (una query per fonte).
 * Ritorna un Set<string> pronto per l'engine di idoneità.
 */
export async function getOwnedServiceSlugs(clientId: string): Promise<Set<string>> {
  const [services, contracts] = await Promise.all([
    prisma.clientCommercialService.findMany({
      where: { clientId, active: true },
      select: { commercialService: { select: { slug: true } } },
    }),
    prisma.clientRetailContract.findMany({
      where: { clientId, status: "ACTIVE" },
      select: { kind: true },
    }),
  ]);
  return ownedSlugsFromRows(
    services.map((s) => s.commercialService.slug),
    contracts.map((c) => c.kind),
  );
}
