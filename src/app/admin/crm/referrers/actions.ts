"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { checkRateLimitPublicReferrer } from "@/lib/rate-limit";
import { runLeadCreatedAutomationRules } from "@/lib/automation-rules-run";
import { notifyReferrerNewLeadFromPortal } from "@/lib/referrer-portal-notify";

export type ReferrerActionResult = { error: string } | null;

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : null;
}

async function uniqueSubmissionToken(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const t = randomBytes(18).toString("hex");
    const clash = await prisma.referrer.findFirst({ where: { submissionToken: t }, select: { id: true } });
    if (!clash) return t;
  }
  throw new Error("Impossibile generare token univoco.");
}

function normalizePayoutIban(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.replace(/\s/g, "").toUpperCase() : "";
  if (!s || s.length < 15 || s.length > 34) return null;
  return s;
}

function parseCommissionPercentField(
  formData: FormData
): { ok: true; value: number | null } | { ok: false; error: string } {
  const raw = formData.get("commissionPercent");
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: true, value: null };
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: "Percentuale commissione non valida (0–100)." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export async function createReferrer(_prev: ReferrerActionResult, formData: FormData): Promise<ReferrerActionResult> {
  const session = await requireAdminArea();
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Nome obbligatorio." };

  const cp = parseCommissionPercentField(formData);
  if (!cp.ok) return { error: cp.error };

  const submissionToken = await uniqueSubmissionToken();

  await prisma.referrer.create({
    data: {
      ownerUserId: session.user.id,
      name,
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      commissionNotes: optionalString(formData.get("commissionNotes")),
      commissionPercent: cp.value,
      payoutIban: normalizePayoutIban(formData.get("payoutIban")),
      active: formData.get("active") === "on",
      submissionToken,
    },
  });

  revalidatePath("/admin/crm/referrers");
  redirect("/admin/crm/referrers");
}

export async function updateReferrer(
  id: string,
  _prev: ReferrerActionResult,
  formData: FormData
): Promise<ReferrerActionResult> {
  const session = await requireAdminArea();
  const existing = await prisma.referrer.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Segnalatore non trovato." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Nome obbligatorio." };

  const cp = parseCommissionPercentField(formData);
  if (!cp.ok) return { error: cp.error };

  await prisma.referrer.update({
    where: { id },
    data: {
      name,
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      commissionNotes: optionalString(formData.get("commissionNotes")),
      commissionPercent: cp.value,
      payoutIban: normalizePayoutIban(formData.get("payoutIban")),
      active: formData.get("active") === "on",
    },
  });

  revalidatePath("/admin/crm/referrers");
  revalidatePath(`/admin/crm/referrers/${id}/edit`);
  revalidatePath("/refer");
  return null;
}

export async function regenerateReferrerPortalToken(id: string): Promise<{ ok: true; token: string } | { error: string }> {
  const session = await requireAdminArea();
  const existing = await prisma.referrer.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Segnalatore non trovato." };

  const submissionToken = await uniqueSubmissionToken();
  await prisma.referrer.update({
    where: { id },
    data: { submissionToken },
  });
  revalidatePath("/admin/crm/referrers");
  revalidatePath(`/admin/crm/referrers/${id}/edit`);
  return { ok: true, token: submissionToken };
}

export async function deleteReferrer(id: string): Promise<ReferrerActionResult> {
  const session = await requireAdminArea();
  const existing = await prisma.referrer.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Segnalatore non trovato." };

  await prisma.referrer.delete({ where: { id } });
  revalidatePath("/admin/crm/referrers");
  return null;
}

export type PublicReferLeadResult = { error: string } | { ok: true } | null;

function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

/** Form pubblico `/refer` — crea lead collegato al segnalatore (token URL). */
export async function submitPublicReferrerLead(
  _prev: PublicReferLeadResult,
  formData: FormData
): Promise<PublicReferLeadResult> {
  const ip = clientIpFromHeaders(headers());
  const rl = await checkRateLimitPublicReferrer(ip);
  if (!rl.ok) {
    return { error: `Troppi invii. Riprova tra ${rl.retryAfter}s.` };
  }

  const honeypot = optionalString(formData.get("companyWebsite"));
  if (honeypot) return { error: "Richiesta non valida." };

  const token = optionalString(formData.get("token"));
  if (!token) return { error: "Link non valido." };

  const referrer = await prisma.referrer.findFirst({
    where: { submissionToken: token, active: true },
    select: { id: true, ownerUserId: true, email: true, name: true },
  });
  if (!referrer) return { error: "Link scaduto o non valido." };

  const businessName = optionalString(formData.get("businessName"));
  const contactName = optionalString(formData.get("contactName"));
  if (!businessName && !contactName) {
    return { error: "Inserisci ragione sociale o nome contatto." };
  }

  const title = businessName ?? contactName ?? "Lead portale segnalatore";

  const lead = await prisma.lead.create({
    data: {
      title,
      businessName,
      contactName,
      phone: optionalString(formData.get("phone")),
      email: optionalString(formData.get("email")),
      notes: optionalString(formData.get("notes")),
      source: "referral_portal",
      status: "NEW",
      ownerUserId: referrer.ownerUserId,
      referrerId: referrer.id,
    },
  });

  void runLeadCreatedAutomationRules(referrer.ownerUserId, lead.id, lead.title);
  const refEmail = referrer.email?.trim();
  if (refEmail) {
    void notifyReferrerNewLeadFromPortal({
      referrerEmail: refEmail,
      referrerName: referrer.name,
      leadTitle: lead.title,
    });
  }
  revalidatePath("/admin/crm/leads");
  revalidatePath("/admin");
  revalidatePath("/refer");
  return { ok: true };
}
