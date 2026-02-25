"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

type ActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");
  return session;
}

export async function createClient(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await ensureAdmin();

  const companyName = formData.get("companyName") as string;
  const slugInput = (formData.get("slug") as string)?.trim();
  const contactEmail = (formData.get("contactEmail") as string)?.trim();

  if (!companyName?.trim()) return { error: "Company name is required." };
  if (!contactEmail?.trim()) return { error: "Contact email is required." }

  const slug = slugInput ? slugify(slugInput) : slugify(companyName);
  if (!slug) return { error: "Slug could not be generated; use letters or numbers." };

  let finalSlug = slug;
  let attempt = 0;
  while (true) {
    const existing = await prisma.client.findUnique({ where: { slug: finalSlug } });
    if (!existing) break;
    attempt++;
    finalSlug = `${slug}-${attempt}`;
  }

  try {
    await prisma.client.create({
      data: {
        companyName: companyName.trim(),
        slug: finalSlug,
        contactEmail: contactEmail,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Failed to create client." };
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect("/admin/clients");
}

export async function updateClient(
  clientId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await ensureAdmin();

  const companyName = formData.get("companyName") as string;
  const slugInput = (formData.get("slug") as string)?.trim();
  const contactEmail = (formData.get("contactEmail") as string)?.trim();

  if (!companyName?.trim()) return { error: "Company name is required." };
  if (!contactEmail?.trim()) return { error: "Contact email is required." };
  const slug = slugify(slugInput || companyName);
  if (!slug) return { error: "Slug could not be generated." };

  const existing = await prisma.client.findFirst({
    where: { slug, id: { not: clientId } },
  });
  if (existing) return { error: "Another client already uses this slug." };

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        companyName: companyName.trim(),
        slug,
        contactEmail,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Failed to update client." };
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect("/admin/clients");
}

export async function deleteClient(clientId: string): Promise<ActionResult> {
  await ensureAdmin();

  try {
    await prisma.client.delete({ where: { id: clientId } });
  } catch (e) {
    console.error(e);
    return { error: "Failed to delete client. It may have dependent data." };
  }

  revalidatePath("/admin/clients");
  revalidatePath("/admin");
  redirect("/admin/clients");
}
