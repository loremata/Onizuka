"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { notifyReferrerPayoutPaid } from "@/lib/referrer-portal-notify";
import { uploadReferrerPayoutDocument } from "@/lib/referrer-payout-document";
import { prisma } from "@/lib/prisma";

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s.slice(0, 500) : null;
}

function optionalUrl(raw: unknown): string | null {
  const s = optionalString(raw);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return s.slice(0, 2000);
  } catch {
    return null;
  }
}

export async function createReferrerPayout(
  referrerId: string,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await requireAdminArea();
  const ref = await prisma.referrer.findFirst({
    where: { id: referrerId, ownerUserId: session.user.id },
  });
  if (!ref) return { error: "Segnalatore non trovato." };

  const amountRaw = (formData.get("amountEur") as string)?.trim().replace(",", ".");
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Importo non valido." };

  const periodLabel = (formData.get("periodLabel") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;
  let documentUrl = optionalUrl(formData.get("documentUrl"));
  const paymentReference = optionalString(formData.get("paymentReference"));
  const docFile = formData.get("documentFile");
  if (docFile instanceof File && docFile.size > 0) {
    const up = await uploadReferrerPayoutDocument(referrerId, docFile);
    if ("error" in up) return { error: up.error };
    documentUrl = up.url;
  }

  await prisma.referrerPayout.create({
    data: {
      referrerId,
      amountEur: amount,
      periodLabel,
      notes,
      documentUrl,
      paymentReference,
      status: "PENDING",
    },
  });

  revalidatePath(`/admin/crm/referrers/${referrerId}/edit`);
  revalidatePath("/refer");
  return null;
}

export async function markReferrerPayoutPaid(
  payoutId: string,
  formData?: FormData
): Promise<{ error: string } | null> {
  const session = await requireAdminArea();
  const row = await prisma.referrerPayout.findFirst({
    where: { id: payoutId },
    include: {
      referrer: { select: { ownerUserId: true, id: true, email: true, name: true } },
    },
  });
  if (!row || row.referrer.ownerUserId !== session.user.id) return { error: "Liquidazione non trovata." };

  const paymentReference = formData ? optionalString(formData.get("paymentReference")) : null;
  let documentUrl = formData ? optionalUrl(formData.get("documentUrl")) : null;
  const docFile = formData?.get("documentFile");
  if (docFile instanceof File && docFile.size > 0) {
    const up = await uploadReferrerPayoutDocument(row.referrer.id, docFile);
    if ("error" in up) return { error: up.error };
    documentUrl = up.url;
  }

  await prisma.referrerPayout.update({
    where: { id: payoutId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(paymentReference ? { paymentReference } : {}),
      ...(documentUrl ? { documentUrl } : row.documentUrl ? {} : {}),
    },
  });

  const refEmail = row.referrer.email?.trim();
  if (refEmail) {
    void notifyReferrerPayoutPaid({
      referrerId: row.referrer.id,
      referrerEmail: refEmail,
      referrerName: row.referrer.name,
      amountEur: row.amountEur.toString(),
      periodLabel: row.periodLabel,
    });
  }

  revalidatePath(`/admin/crm/referrers/${row.referrer.id}/edit`);
  revalidatePath("/refer");
  return null;
}
