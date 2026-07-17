"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { encryptJson } from "@/lib/token-crypto";
import { collectGa4ForConnection } from "@/lib/ga4-collector";
import { collectMetaAdsForConnection, collectGoogleAdsForConnection } from "@/lib/ads-collector";
import type { AnalyticsSource } from "@prisma/client";

/** Normalizza l'ID property GA4 nel formato "properties/123456789". */
function normalizeProperty(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t.startsWith("properties/") ? t : `properties/${t.replace(/\D/g, "")}`;
}

export async function createGa4Connection(
  _prev: unknown,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await requireAdminArea();

  const clientId = (formData.get("clientId") as string)?.trim();
  const externalId = normalizeProperty((formData.get("externalId") as string) ?? "");
  const displayName = (formData.get("displayName") as string)?.trim();

  if (!clientId || !externalId || !displayName) {
    return { error: "Cliente, ID property e nome sono obbligatori." };
  }
  if (!/^properties\/\d+$/.test(externalId)) {
    return { error: "ID property non valido (es. 123456789 oppure properties/123456789)." };
  }

  try {
    await prisma.analyticsConnection.create({
      data: {
        clientId,
        source: "GA4",
        externalId,
        displayName,
        connectedByUserId: session.user.id,
        status: "CONNECTED",
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione non riuscita: forse questa property è già collegata a questo cliente." };
  }

  revalidatePath("/admin/analytics/connections");
  redirect("/admin/analytics/connections");
}

export async function createAdsConnection(
  _prev: unknown,
  formData: FormData
): Promise<{ error: string } | null> {
  await requireAdminArea();

  const clientId = (formData.get("clientId") as string)?.trim();
  const sourceRaw = (formData.get("source") as string)?.trim();
  const externalId = (formData.get("externalId") as string)?.trim();
  const displayName = (formData.get("displayName") as string)?.trim();
  const accessToken = (formData.get("accessToken") as string)?.trim();

  if (!clientId || !sourceRaw || !externalId || !displayName) {
    return { error: "Cliente, tipo, ID account e nome sono obbligatori." };
  }
  if (sourceRaw !== "META_ADS" && sourceRaw !== "GOOGLE_ADS") {
    return { error: "Tipo advertising non valido." };
  }
  if (!accessToken) {
    return { error: "Il token di accesso è obbligatorio." };
  }

  try {
    await prisma.analyticsConnection.create({
      data: {
        clientId,
        source: sourceRaw as AnalyticsSource,
        externalId,
        displayName,
        tokenCipher: encryptJson({ accessToken }),
        status: "CONNECTED",
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione non riuscita: forse questo account è già collegato a questo cliente." };
  }

  revalidatePath("/admin/analytics/connections");
  redirect("/admin/analytics/connections");
}

export async function syncConnection(formData: FormData) {
  await requireAdminArea();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return;
  const conn = await prisma.analyticsConnection.findUnique({ where: { id } });
  if (!conn) return;

  let r: { ok: true; written: number } | { error: string };
  if (conn.source === "GA4") r = await collectGa4ForConnection(conn);
  else if (conn.source === "META_ADS") r = await collectMetaAdsForConnection(conn);
  else if (conn.source === "GOOGLE_ADS") r = await collectGoogleAdsForConnection(conn);
  else r = { error: `Sync non supportato per ${conn.source}.` };

  await prisma.analyticsConnection.update({
    where: { id },
    data: "error" in r ? { lastError: r.error.slice(0, 500) } : { lastSyncAt: new Date(), lastError: null },
  });
  revalidatePath("/admin/analytics/connections");
  revalidatePath("/admin/analytics");
}

export async function deleteConnection(formData: FormData) {
  await requireAdminArea();
  const id = (formData.get("id") as string)?.trim();
  if (!id) return;
  await prisma.analyticsConnection.deleteMany({ where: { id } });
  revalidatePath("/admin/analytics/connections");
}
