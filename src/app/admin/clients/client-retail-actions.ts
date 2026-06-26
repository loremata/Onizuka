"use server";

import { revalidatePath } from "next/cache";
import type { RetailContractKind, RetailContractStatus } from "@prisma/client";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { syncFinanceEntryForRetailContract } from "@/lib/retail-contract-finance-sync";

const KINDS: RetailContractKind[] = ["MOBILE", "FIBER", "ENERGY", "GAS", "SKY", "TELEPASS", "OTHER"];
const SWITCH_OPTIONS = [6, 12, 24, 48];

/** Aggiunge `months` mesi a una data (per la scadenza cambio compagnia). */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function createClientRetailContract(clientId: string, formData: FormData) {
  const session = await requireAdminArea();
  const client = await prisma.client.findFirst({ where: { id: clientId }, select: { id: true } });
  if (!client) return { error: "Cliente non trovato." };

  const label = (formData.get("label") as string)?.trim();
  const kindRaw = formData.get("kind") as string;
  const amountRaw = (formData.get("monthlyEur") as string)?.trim().replace(",", ".");
  const renewalRaw = (formData.get("renewalDate") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim() || null;
  const operator = (formData.get("operator") as string)?.trim() || null;
  const offerName = (formData.get("offerName") as string)?.trim() || null;
  const paymentMethod = (formData.get("paymentMethod") as string)?.trim() || null;
  const signedRaw = (formData.get("signedAt") as string)?.trim();
  const switchRaw = (formData.get("switchAfterMonths") as string)?.trim();

  if (!label) return { error: "Etichetta obbligatoria." };
  if (!KINDS.includes(kindRaw as RetailContractKind)) return { error: "Tipo non valido." };
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo mensile non valido." };

  const renewalDate = renewalRaw ? new Date(renewalRaw) : null;
  if (renewalRaw && renewalDate && Number.isNaN(renewalDate.getTime())) {
    return { error: "Data rinnovo non valida." };
  }

  // Data firma (default oggi) + reminder cambio compagnia.
  const signedAt = signedRaw ? new Date(signedRaw) : new Date();
  if (signedRaw && Number.isNaN(signedAt.getTime())) return { error: "Data firma non valida." };
  const switchAfterMonths = switchRaw && SWITCH_OPTIONS.includes(Number(switchRaw)) ? Number(switchRaw) : null;
  const switchReminderAt = switchAfterMonths ? addMonths(signedAt, switchAfterMonths) : null;

  const created = await prisma.clientRetailContract.create({
    data: {
      clientId,
      ownerUserId: session.user.id,
      kind: kindRaw as RetailContractKind,
      label,
      monthlyEur: amount,
      renewalDate,
      notes,
      operator,
      offerName,
      paymentMethod,
      signedAt,
      switchAfterMonths,
      switchReminderAt,
      status: "ACTIVE",
    },
  });

  await syncFinanceEntryForRetailContract(created);

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/finance");
  revalidatePath("/admin/insights/forecast");
  return null;
}

/** Modifica importo e dati commerciali del contratto, poi ri-sincronizza l'MRR Finance. */
export async function updateClientRetailContract(contractId: string, formData: FormData) {
  const session = await requireAdminArea();
  const existing = await prisma.clientRetailContract.findFirst({
    where: { id: contractId, ownerUserId: session.user.id },
    select: { id: true, clientId: true, signedAt: true },
  });
  if (!existing) return { error: "Contratto non trovato." };

  const amountRaw = (formData.get("monthlyEur") as string)?.trim().replace(",", ".");
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo mensile non valido." };

  const renewalRaw = (formData.get("renewalDate") as string)?.trim();
  const renewalDate = renewalRaw ? new Date(renewalRaw) : null;
  if (renewalRaw && renewalDate && Number.isNaN(renewalDate.getTime())) {
    return { error: "Data rinnovo non valida." };
  }

  const operator = (formData.get("operator") as string)?.trim() || null;
  const offerName = (formData.get("offerName") as string)?.trim() || null;
  const paymentMethod = (formData.get("paymentMethod") as string)?.trim() || null;
  const switchRaw = (formData.get("switchAfterMonths") as string)?.trim();
  const switchAfterMonths = switchRaw && SWITCH_OPTIONS.includes(Number(switchRaw)) ? Number(switchRaw) : null;
  const switchReminderAt =
    switchAfterMonths && existing.signedAt ? addMonths(existing.signedAt, switchAfterMonths) : null;

  const updated = await prisma.clientRetailContract.update({
    where: { id: contractId },
    data: { monthlyEur: amount, renewalDate, operator, offerName, paymentMethod, switchAfterMonths, switchReminderAt },
  });

  // Fonte di verità: il canone vive sul contratto, la FinanceEntry MRR è derivata.
  await syncFinanceEntryForRetailContract(updated);

  revalidatePath(`/admin/clients/${existing.clientId}`);
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
