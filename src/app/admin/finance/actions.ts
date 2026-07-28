"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { FinanceEntryStatus, FinanceEntryType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireFullAdmin } from "@/lib/admin-session";
import { runFinanceIncomeCreatedAutomationRules } from "@/lib/automation-rules-run";
import { prisma } from "@/lib/prisma";
import { parseEurAmount } from "@/lib/parse-eur";

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
  const amountRaw = (formData.get("amountEur") as string) ?? null;
  const clientId = (formData.get("clientId") as string)?.trim() || null;
  // Riferimento facoltativo alla fattura emessa dal commercialista (la
  // numerazione NON è più generata da Onizuka: qui si tiene solo traccia).
  const invoiceNumber = (formData.get("invoiceNumber") as string)?.trim().slice(0, 40) || null;
  const assetIdRaw = (formData.get("assetId") as string)?.trim() || null;
  const dueRaw = (formData.get("dueDate") as string)?.trim();
  const renewalRaw = (formData.get("renewalDate") as string)?.trim();

  if (!label) return { error: "Etichetta obbligatoria." };
  if (!TYPES.includes(typeRaw as FinanceEntryType)) return { error: "Tipo non valido." };

  // Registro AGENZIA: l'importo è l'IMPONIBILE (quello che fatturi prima dell'IVA;
  // es. contratto 3.000 € → fattura 3.660 €). L'imposta è materia del commercialista.
  // NB: i canoni di telefonia in /admin/inserimenti seguono la regola OPPOSTA —
  // lì si registra il prezzo di listino IVA inclusa, perché è la base su cui il
  // gestore calcola il moltiplicatore della gara.
  const amountDecimal = parseEurAmount(amountRaw);
  if (!amountDecimal || amountDecimal.lte(0)) return { error: "Importo non valido." };
  const amount = amountDecimal;

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

  const recurringMonthly = typeRaw === "INCOME" && formData.get("recurringMonthly") === "on";

  let created;
  try {
    created = await prisma.financeEntry.create({
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
  } catch (e) {
    // @@unique([ownerUserId, invoiceNumber]): stesso riferimento fattura due volte.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { error: `Riferimento fattura "${invoiceNumber}" già usato da un'altra voce.` };
    }
    throw e;
  }

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

// La filiera FatturaPA/SDI è stata rimossa: fatturazione elettronica, IVA e
// note di credito sono gestite dal commercialista. Onizuka tiene traccia.
