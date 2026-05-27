"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { FinanceEntryStatus, FinanceEntryType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireFullAdmin } from "@/lib/admin-session";
import { runFinanceIncomeCreatedAutomationRules } from "@/lib/automation-rules-run";
import { prisma } from "@/lib/prisma";
import { nextFinanceInvoiceNumber } from "@/lib/finance-invoice-number";
import { buildAndSendFinanceEntrySdi } from "@/lib/finance-sdi-send";
import { isSdiBridgeConfigured } from "@/lib/finance-sdi";

export type FinanceActionResult = { error: string } | null;

const TYPES: FinanceEntryType[] = ["INCOME", "EXPENSE"];
const STATUSES: FinanceEntryStatus[] = ["PLANNED", "EXPECTED", "RECEIVED", "PAID", "OVERDUE"];

const ensureAdmin = requireFullAdmin;

export async function createFinanceEntry(
  _prev: FinanceActionResult,
  formData: FormData
): Promise<FinanceActionResult> {
  const session = await ensureAdmin();

  const label = (formData.get("label") as string)?.trim();
  const typeRaw = formData.get("type") as string;
  const amountRaw = (formData.get("amountEur") as string)?.trim().replace(",", ".");
  const clientId = (formData.get("clientId") as string)?.trim() || null;
  const assetIdRaw = (formData.get("assetId") as string)?.trim() || null;
  const dueRaw = (formData.get("dueDate") as string)?.trim();
  const renewalRaw = (formData.get("renewalDate") as string)?.trim();

  if (!label) return { error: "Etichetta obbligatoria." };
  if (!TYPES.includes(typeRaw as FinanceEntryType)) return { error: "Tipo non valido." };

  const amount = Number(amountRaw);
  if (Number.isNaN(amount) || amount <= 0) return { error: "Importo non valido." };

  const dueDate = dueRaw ? new Date(dueRaw) : undefined;
  if (dueDate && Number.isNaN(dueDate.getTime())) return { error: "Data non valida." };
  const renewalDate = renewalRaw ? new Date(renewalRaw) : undefined;
  if (renewalDate && Number.isNaN(renewalDate.getTime())) return { error: "Data rinnovo non valida." };

  let assetId: string | null = assetIdRaw;
  if (assetId) {
    if (!clientId) return { error: "Seleziona un cliente per collegare un asset." };
    const asset = await prisma.asset.findFirst({ where: { id: assetId, clientId } });
    if (!asset) return { error: "Asset non valido per il cliente selezionato." };
  } else {
    assetId = null;
  }

  const invoiceNumber =
    typeRaw === "INCOME" ? await nextFinanceInvoiceNumber(session.user.id) : null;

  const recurringMonthly = typeRaw === "INCOME" && formData.get("recurringMonthly") === "on";

  const created = await prisma.financeEntry.create({
    data: {
      ownerUserId: session.user.id,
      label,
      type: typeRaw as FinanceEntryType,
      amountEur: amount,
      clientId,
      assetId,
      invoiceNumber,
      dueDate,
      renewalDate: recurringMonthly ? renewalDate : null,
      recurringMonthly,
      status: typeRaw === "INCOME" ? "EXPECTED" : "PLANNED",
    },
  });

  if (created.type === "INCOME") {
    void runFinanceIncomeCreatedAutomationRules(session.user.id, {
      entryId: created.id,
      label: created.label,
      amountEur: Number(created.amountEur.toString()),
      clientId: created.clientId,
    }).catch(() => {});
  }

  revalidatePath("/admin/finance");
  return null;
}

export async function toggleFinanceEntryRecurring(entryId: string): Promise<FinanceActionResult> {
  const session = await ensureAdmin();
  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id },
  });
  if (!entry) return { error: "Voce non trovata." };
  if (entry.type !== "INCOME") return { error: "Solo le entrate possono essere ricorrenti MRR." };

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: { recurringMonthly: !entry.recurringMonthly },
  });

  revalidatePath("/admin/finance");
  revalidatePath("/admin/insights/forecast");
  return null;
}

export async function updateFinanceEntryRenewalDate(
  entryId: string,
  renewalRaw: string
): Promise<FinanceActionResult> {
  const session = await ensureAdmin();
  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id },
  });
  if (!entry) return { error: "Voce non trovata." };
  if (entry.type !== "INCOME" || !entry.recurringMonthly) {
    return { error: "Solo entrate MRR possono avere data rinnovo." };
  }

  const trimmed = renewalRaw.trim();
  const renewalDate = trimmed ? new Date(trimmed) : null;
  if (trimmed && renewalDate && Number.isNaN(renewalDate.getTime())) {
    return { error: "Data rinnovo non valida." };
  }

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: { renewalDate },
  });

  revalidatePath("/admin/finance");
  revalidatePath("/admin/insights/forecast");
  return null;
}

export async function updateFinanceEntryStatus(
  entryId: string,
  status: FinanceEntryStatus
): Promise<FinanceActionResult> {
  const session = await ensureAdmin();
  if (!STATUSES.includes(status)) return { error: "Stato non valido." };

  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id },
  });
  if (!entry) return { error: "Voce non trovata." };

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: {
      status,
      paidAt: status === "RECEIVED" || status === "PAID" ? new Date() : entry.paidAt,
    },
  });

  revalidatePath("/admin/finance");
  return null;
}

export async function deleteFinanceEntry(entryId: string): Promise<FinanceActionResult> {
  const session = await ensureAdmin();
  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id },
  });
  if (!entry) return { error: "Voce non trovata." };

  await prisma.financeEntry.delete({ where: { id: entryId } });
  revalidatePath("/admin/finance");
  revalidatePath("/admin/insights/forecast");
  return null;
}

export async function markFinanceSdiExported(entryId: string): Promise<FinanceActionResult> {
  const session = await ensureAdmin();
  const entry = await prisma.financeEntry.findFirst({
    where: { id: entryId, ownerUserId: session.user.id, type: "INCOME" },
    include: { client: { select: { companyName: true, vatNumber: true } } },
  });
  if (!entry) return { error: "Voce non trovata o non è un incasso." };
  if (entry.sdiExportedAt) return { error: "Già segnata come inviata a SDI." };

  if (isSdiBridgeConfigured()) {
    const sent = await buildAndSendFinanceEntrySdi({
      entry,
      clientName: entry.client?.companyName ?? null,
      clientVat: entry.client?.vatNumber ?? null,
    });
    if (!sent.ok) return { error: sent.error };
  }

  await prisma.financeEntry.update({
    where: { id: entryId },
    data: { sdiExportedAt: new Date() },
  });
  revalidatePath("/admin/finance");
  return null;
}
