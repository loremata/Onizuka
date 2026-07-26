"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

/**
 * Fase 0 (simulazione): l'unica scrittura consentita dalla UI è il cambio di STATO
 * della campagna (Bozza / Attiva / In pausa / Archiviata). Nessun invio email parte da qui.
 * Le automazioni di invio sono gestite altrove (lib/campaigns, altro agente) e restano
 * in simulazione finché non attivate esplicitamente.
 */
const ALLOWED_STATUS = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
type CampaignStatusValue = (typeof ALLOWED_STATUS)[number];

function parseStatus(raw: FormDataEntryValue | null): CampaignStatusValue | null {
  const v = typeof raw === "string" ? raw : null;
  return v && (ALLOWED_STATUS as readonly string[]).includes(v) ? (v as CampaignStatusValue) : null;
}

/** Cambia lo stato di una campagna cross-sell. Usato dai bottoni "Attiva" / "Metti in pausa". */
export async function setCampaignStatus(campaignId: string, formData: FormData) {
  await requireAdminArea();
  const status = parseStatus(formData.get("status"));
  if (!status) return;

  await prisma.crossSellCampaign.update({
    where: { id: campaignId },
    data: { status },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}
