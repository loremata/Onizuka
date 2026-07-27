/**
 * Attiva sul CRM il possesso corrispondente a una vendita al banco.
 *
 * Chiamato da recordSale SOLO quando la vendita ha un clientId agganciato.
 * BEST-EFFORT e IDEMPOTENTE: non deve mai rompere la registrazione della
 * vendita (il banco è veloce, la propagazione è un bonus). Se la pista non
 * mappa un possesso, è un no-op silenzioso.
 *
 * Dopo l'attivazione fa scattare la propagazione centrale
 * (onClientCommercialStateChanged): il cliente esce dalle campagne del
 * servizio che ora possiede.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { onClientCommercialStateChanged } from "@/lib/campaigns/client-commercial-events";
import { mapStoreSaleToOwnership } from "@/lib/inserimenti/sale-to-service";

export interface ApplySaleToClientInput {
  clientId: string;
  sale: {
    brand: string;
    lineKey: string;
    subtype?: string | null;
    offerCode?: string | null;
    feeEur?: number | null;
    /** Owner della vendita (operatore al banco): usato come owner del contratto. */
    ownerUserId: string;
  };
}

/** Etichetta leggibile del contratto retail dal brand + offerta della vendita. */
function retailLabel(brand: string, offerCode?: string | null): string {
  const b = (brand || "").trim();
  const offer = (offerCode || "").trim();
  return offer ? `${b} · ${offer}` : b || "Contratto";
}

export async function applySaleToClient({ clientId, sale }: ApplySaleToClientInput): Promise<void> {
  const ownership = mapStoreSaleToOwnership(sale);
  if (!ownership) return; // pista non attivabile → solo compenso, niente CRM

  let changed = false;

  // --- Contratto retail (MOBILE/FIBER/ENERGY/GAS/TELEPASS) ---------------------
  if (ownership.retailKind) {
    const existing = await prisma.clientRetailContract.findFirst({
      where: { clientId, kind: ownership.retailKind, status: "ACTIVE" },
      select: { id: true },
    });
    // Idempotente: se c'è già un contratto ATTIVO dello stesso tipo, non duplico.
    if (!existing) {
      const monthly =
        sale.feeEur != null && Number.isFinite(sale.feeEur) && sale.feeEur > 0
          ? new Prisma.Decimal(sale.feeEur)
          : new Prisma.Decimal(0);
      await prisma.clientRetailContract.create({
        data: {
          clientId,
          ownerUserId: sale.ownerUserId,
          kind: ownership.retailKind,
          label: retailLabel(sale.brand, sale.offerCode),
          monthlyEur: monthly,
          operator: sale.brand || null,
          offerName: sale.offerCode || null,
          signedAt: new Date(),
          status: "ACTIVE",
        },
      });
      changed = true;
    }
  }

  // --- Servizio commerciale del catalogo (es. tim-vision) ----------------------
  if (ownership.serviceSlug) {
    const service = await prisma.commercialService.findUnique({
      where: { slug: ownership.serviceSlug },
      select: { id: true },
    });
    if (service) {
      // upsert idempotente sull'unique (clientId, commercialServiceId).
      const before = await prisma.clientCommercialService.findUnique({
        where: { clientId_commercialServiceId: { clientId, commercialServiceId: service.id } },
        select: { active: true },
      });
      await prisma.clientCommercialService.upsert({
        where: { clientId_commercialServiceId: { clientId, commercialServiceId: service.id } },
        update: { active: true, inactiveReason: null },
        create: {
          clientId,
          commercialServiceId: service.id,
          active: true,
          since: new Date(),
        },
      });
      if (!before?.active) changed = true;
    }
  }

  // --- Propagazione centrale (best-effort: già non-throwing internamente) ------
  if (changed) {
    await onClientCommercialStateChanged(clientId, { reason: "store_sale" });
  }
}
