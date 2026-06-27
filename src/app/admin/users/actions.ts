"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { hash } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { requireFullAdmin } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { isWeakPassword, weakPasswordMessage } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

type ActionResult = { error: string } | null;

async function ensureAdmin() {
  const session = await requireFullAdmin();
  return session;
}

export async function createUser(
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const password = formData.get("password") as string;
  const role = (formData.get("role") as Role) || "CLIENT";
  const clientId = (formData.get("clientId") as string)?.trim() || null;

  if (!email) return { error: "L'email è obbligatoria." };
  if (!password || password.length < 8) return { error: "La password deve avere almeno 8 caratteri." };
  if (process.env.NODE_ENV === "production" && isWeakPassword(password)) {
    return { error: weakPasswordMessage() };
  }
  if (role === "CLIENT" && !clientId) return { error: "Per gli utenti cliente è obbligatorio selezionare un cliente." };
  if ((role === "ADMIN" || role === "STAFF") && clientId) {
    return { error: "Admin e staff non possono essere associati a un cliente." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Esiste già un utente con questa email." };

  const passwordHash = await hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role,
        clientId: role === "CLIENT" ? clientId : null,
      },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "user.create",
      entityType: "user",
      entityId: user.id,
      summary: `Creato utente ${email} (${role})`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Creazione utente non riuscita." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}

export async function deleteUser(userId: string): Promise<void> {
  const session = await ensureAdmin();
  if (userId === session.user.id) return; // mai eliminare sé stessi
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!target) return;
  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return; // mantieni almeno un admin
  }
  try {
    await prisma.user.delete({ where: { id: userId } });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "user.delete",
      entityType: "user",
      entityId: userId,
      summary: `Eliminato utente ${target.email}`,
    });
  } catch (e) {
    console.error(e);
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function resetPassword(
  userId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionResult> {
  const session = await ensureAdmin();

  const password = formData.get("password") as string;
  if (!password || password.length < 8) return { error: "La password deve avere almeno 8 caratteri." };
  if (process.env.NODE_ENV === "production" && isWeakPassword(password)) {
    return { error: weakPasswordMessage() };
  }

  const passwordHash = await hash(password, 12);

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: userId !== session.user.id },
    });
    void logAuditEvent({
      actorUserId: session.user.id,
      action: "user.reset_password",
      entityType: "user",
      entityId: userId,
      summary: `Password reimpostata per ${target?.email ?? userId}`,
    });
  } catch (e) {
    console.error(e);
    return { error: "Aggiornamento password non riuscito." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}
