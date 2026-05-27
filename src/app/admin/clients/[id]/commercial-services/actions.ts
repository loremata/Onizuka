"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { seedCommercialCatalog } from "@/lib/commercial-catalog-seed";

export type ClientServiceActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await requireAdminArea();
  return session;
}

export async function syncClientCommercialServices(
  clientId: string,
  _prev: ClientServiceActionResult,
  formData: FormData
): Promise<ClientServiceActionResult> {
  await ensureAdmin();
  await seedCommercialCatalog();

  const catalog = await prisma.commercialService.findMany({ select: { id: true, slug: true } });

  for (const svc of catalog) {
    const active = formData.get(`active_${svc.slug}`) === "on";
    const notes = (formData.get(`notes_${svc.slug}`) as string)?.trim() || null;

    await prisma.clientCommercialService.upsert({
      where: {
        clientId_commercialServiceId: {
          clientId,
          commercialServiceId: svc.id,
        },
      },
      update: { active, notes },
      create: {
        clientId,
        commercialServiceId: svc.id,
        active,
        notes,
        since: active ? new Date() : undefined,
      },
    });
  }

  revalidatePath(`/admin/clients/${clientId}`);
  return null;
}
