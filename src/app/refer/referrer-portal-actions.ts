"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  clearReferrerPortalSession,
  getReferrerIdFromPortalSession,
  setReferrerPortalSession,
} from "@/lib/referrer-portal-session";

export type ReferrerPortalLoginResult = { error: string } | { ok: true };

export async function loginReferrerPortal(
  _prev: ReferrerPortalLoginResult | undefined,
  formData: FormData
): Promise<ReferrerPortalLoginResult> {
  const token = (formData.get("token") as string)?.trim();
  const pin = (formData.get("pin") as string)?.trim();
  if (!token || token.length < 16) return { error: "Link non valido." };
  if (!pin || pin.length < 4) return { error: "PIN obbligatorio (min 4 caratteri)." };

  const referrer = await prisma.referrer.findFirst({
    where: { submissionToken: token, active: true },
    select: { id: true, portalPinHash: true },
  });
  if (!referrer) return { error: "Segnalatore non trovato o disattivo." };
  if (!referrer.portalPinHash) return { error: "PIN non configurato dall'agenzia. Contatta l'ufficio commerciale." };

  const ok = await compare(pin, referrer.portalPinHash);
  if (!ok) return { error: "PIN non corretto." };

  await setReferrerPortalSession(referrer.id);
  revalidatePath("/refer");
  return { ok: true };
}

export async function logoutReferrerPortal(): Promise<void> {
  await clearReferrerPortalSession();
  revalidatePath("/refer");
}

export async function assertReferrerPortalAccess(
  submissionToken: string
): Promise<{ referrerId: string } | null> {
  const sessionId = await getReferrerIdFromPortalSession();
  if (!sessionId) return null;
  const referrer = await prisma.referrer.findFirst({
    where: { id: sessionId, submissionToken, active: true },
    select: { id: true },
  });
  if (!referrer) return null;
  return { referrerId: referrer.id };
}

export async function setReferrerPortalPinAction(
  referrerId: string,
  pin: string
): Promise<{ ok: true } | { error: string }> {
  const { requireAdminArea } = await import("@/lib/admin-session");
  const session = await requireAdminArea();
  const existing = await prisma.referrer.findFirst({
    where: { id: referrerId, ownerUserId: session.user.id },
  });
  if (!existing) return { error: "Segnalatore non trovato." };
  const trimmed = pin.trim();
  if (trimmed.length < 4 || trimmed.length > 32) {
    return { error: "PIN tra 4 e 32 caratteri." };
  }
  const portalPinHash = await hash(trimmed, 10);
  await prisma.referrer.update({ where: { id: referrerId }, data: { portalPinHash } });
  revalidatePath(`/admin/crm/referrers/${referrerId}/edit`);
  return { ok: true };
}
