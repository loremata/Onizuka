"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { ALL_ADMIN_MODULES, type AdminModule } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";

function parseModulesFromForm(formData: FormData): AdminModule[] {
  const raw = formData.getAll("modules").map((v) => String(v));
  return raw.filter((m): m is AdminModule => ALL_ADMIN_MODULES.includes(m as AdminModule));
}

export async function updateStaffPermissionsInline(
  userId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireFullAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!user || user.role !== "STAFF") {
    return { ok: false, error: "Utente staff non trovato." };
  }

  const modules = parseModulesFromForm(formData);

  await prisma.user.update({
    where: { id: userId },
    data: { staffAllowedModules: modules },
  });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "user.staff_permissions",
    entityType: "user",
    entityId: userId,
    summary: `Permessi staff (inline) per ${user.email}`,
    metadata: { modules },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
