"use server";

import { revalidatePath } from "next/cache";
import type { RetailContractKind, RetailContractStatus } from "@prisma/client";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { syncFinanceEntryForRetailContract } from "@/lib/retail-contract-finance-sync";

const KINDS: RetailContractKind[] = ["MOBILE", "ENERGY", "SKY", "OTHER"];

export async function createClientRetailContract(clientId: string, formData: FormData) {
  const session = await requireAdminArea();
  const client = await prisma.client.findFirst({ where: { id: clientId }, select: { id: true } });
  if (!client) return { error: "Cliente non trovato." };

  const label = (formData.get("label") as string)?.trim();
  const kindRaw = formData.get("kind") as string;
  const amountRaw = (formData.get("monthlyEur") as string)?.trim().replace(",", ".");
  const renewalRaw = (formData.get("renewalDate") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!label) return { error: "Etichetta obbligatoria." };
  if (!KINDS.includes(kindRaw as RetailContractKind)) return { error: "Tipo non valido." };
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo mensile non valido." };

  const renewalDate = renewalRaw ? new Date(renewalRaw) : null;
  if (renewalRaw && renewalDate && Number.isNaN(renewalDate.getTime())) {
    return { error: "Data rinnovo non valida." };
  }

  const created = await prisma.clientRetailContract.create({
    data: {
      clientId,
      ownerUserId: session.user.id,
      kind: kindRaw as RetailContractKind,
      label,
      monthlyEur: amount,
      renewalDate,
      notes,
      status: "ACTIVE",
    },
  });

  await syncFinanceEntryForRetailContract(created);

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/finance");
  revalidatePath("/admin/insights/forecast");
  return null;
}

export async function updateRetailContractStatus(contractId: string, status: RetailContractStatus) {
  const session = await requireAdminArea();
  const row = await prisma.clientRetailContract.findFirst({
    where: { id: contractId, ownerUserId: session.user.id },
  });
  if (!row) return;

  const updated = await prisma.clientRetailContract.update({
    where: { id: contractId },
    data: { status },
  });

  await syncFinanceEntryForRetailContract(updated);
  revalidatePath(`/admin/clients/${row.clientId}`);
  revalidatePath("/admin/finance");
  revalidatePath("/admin/insights/forecast");
}
