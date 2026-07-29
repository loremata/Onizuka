"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea, requireFullAdmin } from "@/lib/admin-session";
import { isValidIanaTimeZone } from "@/lib/day-bounds";
import { prisma } from "@/lib/prisma";

export type RecapTzActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function setRecapTimeZonePreference(
  _prev: RecapTzActionResult,
  formData: FormData
): Promise<RecapTzActionResult> {
  const session = await ensureAdmin();

  const raw = (formData.get("timeZone") as string)?.trim() ?? "";

  if (raw && !isValidIanaTimeZone(raw)) {
    return { error: "Fuso orario IANA non valido." };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { timeZone: raw || null },
    });
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

export async function setNotifyDigestEmailPreference(
  _prev: RecapTzActionResult,
  formData: FormData
): Promise<RecapTzActionResult> {
  const session = await ensureAdmin();
  const enabled = formData.get("notifyDigestEmail") === "1";

  try {
    const { saveNotifyDigestEmailPreference } = await import("@/lib/notify-digest-preference");
    await saveNotifyDigestEmailPreference(session.user.id, enabled);
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/notifications");
  redirect("/admin/settings");
}

export type MarketingPolicyActionResult =
  | { error: string }
  | { ok: true; reclassified: number }
  | null;

/**
 * Politica di classificazione della base giuridica per i contatti reperiti da
 * fonti pubbliche. Salvare la politica riclassifica anche i contatti già a
 * sistema che non hanno ancora una base e non si sono disiscritti, così
 * l'impostazione ha un effetto immediato e verificabile.
 */
export async function setMarketingPolicy(
  _prev: MarketingPolicyActionResult,
  formData: FormData
): Promise<MarketingPolicyActionResult> {
  const session = await requireFullAdmin();

  const rawBasis = (formData.get("marketingAutoBasis") as string)?.trim();
  if (rawBasis !== "LEGITIMATE_INTEREST" && rawBasis !== "NONE") {
    return { error: "Scelta non valida." };
  }
  const { parseExcludedDomains } = await import("@/lib/marketing-consent-policy");
  const excluded = parseExcludedDomains(formData.get("marketingExcludedDomains") as string);

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { marketingAutoBasis: rawBasis, marketingExcludedDomains: excluded },
    });

    let reclassified = 0;
    if (rawBasis === "LEGITIMATE_INTEREST") {
      const { applyMarketingPolicyToExistingContacts } = await import(
        "@/lib/marketing-consent-backfill"
      );
      reclassified = await applyMarketingPolicyToExistingContacts({
        marketingAutoBasis: rawBasis,
        marketingExcludedDomains: excluded,
      });
    }

    revalidatePath("/admin/settings");
    revalidatePath("/admin/reach");
    return { ok: true, reclassified };
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }
}

export type ReachCapActionResult = { error: string } | { ok: true; cap: number } | null;

/** Applica il tetto agli invii automatici (follow-up). */
export async function applyReachDailyCap(
  _prev: ReachCapActionResult,
  formData: FormData
): Promise<ReachCapActionResult> {
  const session = await requireFullAdmin();
  const raw = Number((formData.get("cap") as string)?.trim());
  if (!Number.isFinite(raw) || raw < 1 || raw > 500) {
    return { error: "Valore non valido (1–500 invii al giorno)." };
  }
  try {
    const { setDailyCap } = await import("@/lib/outreach-send-cap");
    await setDailyCap(session.user.id, raw);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/reach");
    return { ok: true, cap: Math.round(raw) };
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }
}
