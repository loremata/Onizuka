"use server";

import { hash, compare } from "bcryptjs";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { isWeakPassword, weakPasswordMessage } from "@/lib/password-policy";
import { prisma } from "@/lib/prisma";

export type PasswordActionResult = { error: string } | null;

export async function changeOwnPassword(
  _prev: PasswordActionResult,
  formData: FormData
): Promise<PasswordActionResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const current = (formData.get("currentPassword") as string) ?? "";
  const next = (formData.get("newPassword") as string) ?? "";
  const confirm = (formData.get("confirmPassword") as string) ?? "";

  if (!current || !next) return { error: "Compila tutti i campi." };
  if (next.length < 8) return { error: "La nuova password deve avere almeno 8 caratteri." };
  if (next !== confirm) return { error: "Le password non coincidono." };
  if (process.env.NODE_ENV === "production" && isWeakPassword(next)) {
    return { error: weakPasswordMessage() };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, email: true },
  });
  if (!user?.passwordHash) return { error: "Account senza password locale." };

  const valid = await compare(current, user.passwordHash);
  if (!valid) return { error: "Password attuale non corretta." };

  const passwordHash = await hash(next, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "user.change_own_password",
    entityType: "user",
    entityId: session.user.id,
    summary: `Password aggiornata · ${user.email}`,
  });

  const callback = encodeURIComponent("/login?passwordChanged=1");
  redirect(`/api/auth/signout?callbackUrl=${callback}`);
}
