"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Platform } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { platformOptions } from "@/lib/platform-label";

export type AssetActionResult = { error: string } | null;

function optionalString(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s ? s : null;
}

function parsePlatform(raw: string | null): Platform | null {
  if (!raw?.trim()) return null;
  return platformOptions.includes(raw as Platform) ? (raw as Platform) : null;
}

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function createAssetForClient(
  clientId: string,
  _prev: AssetActionResult,
  formData: FormData
): Promise<AssetActionResult> {
  await ensureAdmin();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "Cliente non trovato." };

  const name = (formData.get("name") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const platform = parsePlatform((formData.get("platform") as string) ?? null);
  const notes = optionalString(formData.get("notes"));
  const profileUrl = optionalString(formData.get("profileUrl"));
  const gbpLocationName = optionalString(formData.get("gbpLocationName"));

  if (!name) return { error: "Il nome asset è obbligatorio." };

  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!slug) return { error: "Impossibile generare lo slug; usa lettere o numeri." };

  let finalSlug = slug;
  let attempt = 0;
  while (true) {
    const existing = await prisma.asset.findUnique({
      where: { clientId_slug: { clientId, slug: finalSlug } },
    });
    if (!existing) break;
    attempt++;
    finalSlug = `${slug}-${attempt}`;
  }

  try {
    await prisma.asset.create({
      data: {
        clientId,
        name,
        slug: finalSlug,
        platform: platform ?? undefined,
        profileUrl,
        gbpLocationName,
        notes,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione asset non riuscita." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin/memory");
  revalidatePath("/admin/search");
  revalidatePath("/admin/crm/pipeline");
  redirect(`/admin/clients/${clientId}`);
}

export async function updateAsset(
  assetId: string,
  clientId: string,
  _prev: AssetActionResult,
  formData: FormData
): Promise<AssetActionResult> {
  await ensureAdmin();

  const existing = await prisma.asset.findFirst({
    where: { id: assetId, clientId },
  });
  if (!existing) return { error: "Asset non trovato." };

  const name = (formData.get("name") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const platform = parsePlatform((formData.get("platform") as string) ?? null);
  const notes = optionalString(formData.get("notes"));
  const profileUrl = optionalString(formData.get("profileUrl"));
  const gbpLocationName = optionalString(formData.get("gbpLocationName"));

  if (!name) return { error: "Il nome asset è obbligatorio." };

  const slug = slugInput ? slugify(slugInput) : slugify(name);
  if (!slug) return { error: "Impossibile generare lo slug; usa lettere o numeri." };

  let finalSlug = slug;
  let attempt = 0;
  while (true) {
    const clash = await prisma.asset.findUnique({
      where: { clientId_slug: { clientId, slug: finalSlug } },
    });
    if (!clash || clash.id === assetId) break;
    attempt++;
    finalSlug = `${slug}-${attempt}`;
  }

  try {
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        name,
        slug: finalSlug,
        platform,
        profileUrl,
        gbpLocationName,
        notes,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento asset non riuscito." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/assets/${assetId}/edit`);
  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin/memory");
  revalidatePath("/admin/search");
  revalidatePath("/admin/crm/pipeline");
  redirect(`/admin/clients/${clientId}`);
}

export async function deleteAsset(_prev: AssetActionResult, formData: FormData): Promise<AssetActionResult> {
  await ensureAdmin();

  const id = optionalString(formData.get("id"));
  if (!id) return { error: "ID mancante." };

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return { error: "Asset non trovato." };

  const clientId = existing.clientId;

  try {
    await prisma.asset.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    return { error: "Eliminazione non riuscita." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/crm/opportunities");
  revalidatePath("/admin/memory");
  revalidatePath("/admin/search");
  revalidatePath("/admin/crm/pipeline");
  redirect(`/admin/clients/${clientId}`);
}
