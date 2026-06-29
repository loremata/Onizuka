"use server";

import { revalidatePath } from "next/cache";
import type { RetailContractKind } from "@prisma/client";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ensureCommercialCatalogSeeded } from "@/lib/commercial-catalog-seed";
import { syncFinanceEntryForRetailContract } from "@/lib/retail-contract-finance-sync";
import { promoteClientToClienteIfNeeded } from "@/lib/client-promote";

/**
 * Toggle di una "casella" servizi digitali dalla snapshot: se almeno un servizio
 * dell'area è attivo lo disattiva tutto, altrimenti attiva quello primario.
 */
export async function toggleClientServiceSlot(clientId: string, slugsCsv: string): Promise<void> {
  await requireAdminArea();
  await ensureCommercialCatalogSeeded();
  const slugs = slugsCsv.split(",").filter(Boolean);
  if (!slugs.length) return;

  const services = await prisma.commercialService.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  if (!services.length) return;
  const ids = services.map((s) => s.id);

  const active = await prisma.clientCommercialService.count({
    where: { clientId, commercialServiceId: { in: ids }, active: true },
  });

  if (active > 0) {
    // Disattiva tutti i servizi dell'area.
    await prisma.clientCommercialService.updateMany({
      where: { clientId, commercialServiceId: { in: ids } },
      data: { active: false, inactiveReason: "disattivato" },
    });
  } else {
    // Attiva il servizio primario (primo slug dell'area).
    const primary = services.find((s) => s.slug === slugs[0]) ?? services[0];
    await prisma.clientCommercialService.upsert({
      where: { clientId_commercialServiceId: { clientId, commercialServiceId: primary.id } },
      update: { active: true, inactiveReason: null, since: new Date() },
      create: { clientId, commercialServiceId: primary.id, active: true, since: new Date() },
    });
    // Servizio attivato ⇒ promuovi a CLIENTE se era prospect/ex.
    await promoteClientToClienteIfNeeded(clientId);
  }

  revalidatePath(`/admin/clients/${clientId}`);
}

/**
 * Toggle di una "casella" telefonia/utenze dalla snapshot:
 *  - se esiste un contratto del tipo → alterna ACTIVE ↔ EXPIRED (con sync MRR),
 *  - se non esiste → crea un contratto-segnaposto ATTIVO (cifre da completare nell'edit).
 */
export async function toggleClientRetailKind(
  clientId: string,
  kind: RetailContractKind,
  label: string
): Promise<void> {
  const session = await requireAdminArea();

  const existing = await prisma.clientRetailContract.findFirst({
    where: { clientId, kind },
    orderBy: { createdAt: "desc" },
  });

  let activated = false;
  if (existing) {
    const next = existing.status === "ACTIVE" ? "EXPIRED" : "ACTIVE";
    const updated = await prisma.clientRetailContract.update({
      where: { id: existing.id },
      data: { status: next },
    });
    await syncFinanceEntryForRetailContract(updated);
    activated = next === "ACTIVE";
  } else {
    const created = await prisma.clientRetailContract.create({
      data: {
        clientId,
        ownerUserId: session.user.id,
        kind,
        label,
        monthlyEur: 0,
        status: "ACTIVE",
        signedAt: new Date(),
      },
    });
    await syncFinanceEntryForRetailContract(created);
    activated = true;
  }

  // Contratto attivato ⇒ promuovi a CLIENTE se era prospect/ex.
  if (activated) await promoteClientToClienteIfNeeded(clientId);

  revalidatePath(`/admin/clients/${clientId}`);
}
