"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

type ActionResult = { error: string } | null;

function clean(s: string, max: number): string {
  return s.trim().slice(0, max);
}

function revalidate(clientId: string) {
  revalidatePath("/admin/crm/database");
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function addClientTag(clientId: string, tagRaw: string): Promise<ActionResult> {
  await requireAdminArea();
  const tag = clean(tagRaw, 60);
  if (!tag) return { error: "Tag vuoto." };

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { tags: true } });
  if (!client) return { error: "Cliente non trovato." };
  if (client.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
    revalidate(clientId);
    return null;
  }
  await prisma.client.update({ where: { id: clientId }, data: { tags: { push: tag } } });
  revalidate(clientId);
  return null;
}

export async function removeClientTag(clientId: string, tag: string): Promise<ActionResult> {
  await requireAdminArea();
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { tags: true } });
  if (!client) return { error: "Cliente non trovato." };
  await prisma.client.update({
    where: { id: clientId },
    data: { tags: { set: client.tags.filter((t) => t !== tag) } },
  });
  revalidate(clientId);
  return null;
}

export async function setClientAttribute(
  clientId: string,
  keyRaw: string,
  valueRaw: string
): Promise<ActionResult> {
  await requireAdminArea();
  const key = clean(keyRaw, 60);
  const value = clean(valueRaw, 120);
  if (!key) return { error: "Chiave attributo vuota." };

  await prisma.clientAttribute.upsert({
    where: { clientId_key: { clientId, key } },
    create: { clientId, key, value },
    update: { value },
  });
  revalidate(clientId);
  return null;
}

export async function removeClientAttribute(clientId: string, key: string): Promise<ActionResult> {
  await requireAdminArea();
  await prisma.clientAttribute
    .delete({ where: { clientId_key: { clientId, key } } })
    .catch(() => undefined);
  revalidate(clientId);
  return null;
}
