"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

type ActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");
  return session;
}

export async function createUser(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await ensureAdmin();

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as Role) || "CLIENT";
  const clientId = (formData.get("clientId") as string)?.trim() || null;

  if (!email) return { error: "Email is required." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };
  if (role === "CLIENT" && !clientId) return { error: "Client is required for client users." };
  if (role === "ADMIN" && clientId) return { error: "Admin users must not be assigned to a client." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists." };

  const passwordHash = await hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role,
        clientId: role === "CLIENT" ? clientId : null,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Failed to create user." };
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function resetPassword(
  userId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  await ensureAdmin();

  const password = formData.get("password") as string;
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };

  const passwordHash = await hash(password, 12);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  } catch (e) {
    console.error(e);
    return { error: "Failed to update password." };
  }

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
