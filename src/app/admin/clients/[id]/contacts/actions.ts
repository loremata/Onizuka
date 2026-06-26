"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { syncPersonFromClientContact } from "@/lib/person-crm";

export type ContactActionResult = { error: string } | null;

async function requireAdmin() {
  const session = await requireAdminArea();
  return session;
}

async function loadClient(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return client;
}

export async function createClientContact(
  clientId: string,
  _prev: ContactActionResult,
  formData: FormData
): Promise<ContactActionResult> {
  const session = await requireAdmin();
  if (!(await loadClient(clientId))) return { error: "Cliente non trovato." };

  const name = (formData.get("name") as string)?.trim();
  const role = (formData.get("role") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";

  if (!name) return { error: "Il nome è obbligatorio." };

  try {
    if (isPrimary) {
      await prisma.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    }
    await prisma.clientContact.create({
      data: { clientId, name, role, email, phone, isPrimary },
    });
    // Canonico recapiti: il referente primario aggiorna i recapiti della scheda cliente.
    if (isPrimary && email) {
      await prisma.client.update({ where: { id: clientId }, data: { contactEmail: email, phone } });
    }
    await syncPersonFromClientContact({
      ownerUserId: session.user.id,
      clientId,
      name,
      role,
      email,
      phone,
      isPrimary,
    }).catch(() => undefined);
  } catch (e) {
    console.error(e);
    return { error: "Salvataggio non riuscito." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/crm/people");
  revalidatePath(`/admin/clients/${clientId}/contacts`);
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  redirect(`/admin/clients/${clientId}/contacts`);
}

export async function updateClientContact(
  contactId: string,
  clientId: string,
  _prev: ContactActionResult,
  formData: FormData
): Promise<ContactActionResult> {
  const session = await requireAdmin();
  const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId } });
  if (!existing) return { error: "Referente non trovato." };

  const name = (formData.get("name") as string)?.trim();
  const role = (formData.get("role") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";

  if (!name) return { error: "Il nome è obbligatorio." };

  try {
    if (isPrimary) {
      await prisma.clientContact.updateMany({
        where: { clientId, NOT: { id: contactId } },
        data: { isPrimary: false },
      });
    }
    await prisma.clientContact.update({
      where: { id: contactId },
      data: { name, role, email, phone, isPrimary },
    });
    // Canonico recapiti: il referente primario aggiorna i recapiti della scheda cliente.
    if (isPrimary && email) {
      await prisma.client.update({ where: { id: clientId }, data: { contactEmail: email, phone } });
    }
    await syncPersonFromClientContact({
      ownerUserId: session.user.id,
      clientId,
      name,
      role,
      email,
      phone,
      isPrimary,
    }).catch(() => undefined);
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento non riuscito." };
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/contacts`);
  revalidatePath(`/admin/clients/${clientId}/contacts/${contactId}/edit`);
  revalidatePath("/admin/crm/people");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  redirect(`/admin/clients/${clientId}/contacts`);
}

export async function deleteClientContact(contactId: string, clientId: string) {
  await requireAdmin();
  const existing = await prisma.clientContact.findFirst({ where: { id: contactId, clientId } });
  if (!existing) redirect(`/admin/clients/${clientId}/contacts`);

  try {
    await prisma.clientContact.delete({ where: { id: contactId } });
  } catch (e) {
    console.error(e);
    redirect(`/admin/clients/${clientId}/contacts/${contactId}/edit`);
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/admin/clients/${clientId}/contacts`);
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  redirect(`/admin/clients/${clientId}/contacts`);
}
