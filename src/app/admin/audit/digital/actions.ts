"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { runDigitalAuditByVat, runDigitalAuditForClient } from "@/lib/digital-audit-run";
import { runDigitalAuditUnified } from "@/lib/audit-commercial-entry";
import { syncAuditSheetQueue } from "@/lib/audit-sheet-ingest";
import { processAuditSheetQueueBatch } from "@/lib/audit-sheet-queue-processor";
import { ensureDigitalAuditPublicReportToken } from "@/lib/public-report-token";
import { normalizeVatNumber } from "@/lib/fiscal-normalize";
import { prisma } from "@/lib/prisma";

export type DigitalAuditActionResult = { error: string } | { auditId: string } | null;

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function startDigitalAuditByVat(
  _prev: DigitalAuditActionResult,
  formData: FormData
): Promise<DigitalAuditActionResult> {
  const session = await ensureAdmin();
  const vat = normalizeVatNumber((formData.get("vatNumber") as string)?.trim());
  const website = (formData.get("website") as string)?.trim() || undefined;
  const businessName = (formData.get("businessName") as string)?.trim() || undefined;
  const withOutreach = formData.get("createOutreach") === "on";

  if ((!vat || vat.length < 9) && !website && !businessName) {
    return { error: "Inserire P.IVA valida oppure dominio/ragione sociale." };
  }

  try {
    const result =
      vat && vat.length >= 9
        ? await runDigitalAuditByVat({
            ownerUserId: session.user.id,
            vatNumber: vat,
            website,
            businessName,
            createOutreachDraft: withOutreach,
          })
        : await runDigitalAuditUnified({
            ownerUserId: session.user.id,
            website,
            businessName,
            acquisitionSource: "vat_form",
            createOutreachDraft: withOutreach,
          }).then((r) => ({
            auditId: r.auditId,
            clientId: r.clientId,
            leadId: r.leadId,
          }));
    revalidatePath("/admin/audit/digital");
    revalidatePath("/admin/reach");
    revalidatePath(`/admin/clients/${result.clientId}`);
    redirect(`/admin/audit/digital/${result.auditId}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Audit fallito" };
  }
}

export async function startDigitalAuditForClientId(
  clientId: string,
  createOutreach = false
): Promise<DigitalAuditActionResult> {
  const session = await ensureAdmin();

  try {
    const result = await runDigitalAuditForClient({
      ownerUserId: session.user.id,
      clientId,
      createOutreachDraft: createOutreach,
    });
    revalidatePath("/admin/audit/digital");
    revalidatePath("/admin/reach");
    revalidatePath(`/admin/clients/${clientId}`);
    return { auditId: result.auditId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Audit fallito" };
  }
}

export async function deleteDigitalAudit(auditId: string): Promise<{ error: string } | null> {
  const session = await ensureAdmin();
  const res = await prisma.digitalAudit.deleteMany({
    where: { id: auditId, ownerUserId: session.user.id },
  });
  if (res.count === 0) return { error: "Audit non trovato." };
  revalidatePath("/admin/audit/digital");
  return null;
}

export async function syncAuditSheetFromGoogle(): Promise<
  | { error: string }
  | { parsed: number; enqueued: number; skipped: number; rejected: { rowIndex: number; reason: string }[] }
> {
  const session = await ensureAdmin();
  try {
    const result = await syncAuditSheetQueue(session.user.id);
    revalidatePath("/admin/audit/digital");
    revalidatePath("/admin/inbox");
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import fallito" };
  }
}

export async function processAuditSheetQueueAction(limit = 5): Promise<
  { error: string } | { processed: number; done: number; failed: number; skipped: number }
> {
  await ensureAdmin();
  try {
    const result = await processAuditSheetQueueBatch(limit);
    revalidatePath("/admin/audit/digital");
    revalidatePath("/admin/inbox");
    return result;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Elaborazione fallita" };
  }
}

export async function rotateDigitalAuditPublicLink(
  auditId: string
): Promise<{ error: string } | { url: string; expiresAt: string | null }> {
  const session = await ensureAdmin();
  try {
    const { token, expiresAt } = await ensureDigitalAuditPublicReportToken(auditId, session.user.id, {
      rotate: true,
    });
    const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
    revalidatePath(`/admin/audit/digital/${auditId}`);
    return {
      url: `${base}/report/${token}`,
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Token non generato" };
  }
}
