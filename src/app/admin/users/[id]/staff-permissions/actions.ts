"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFullAdmin } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { ALL_ADMIN_MODULES, type AdminModule } from "@/lib/staff-permissions";
import { ALL_STAFF_ACTIONS, type StaffAdminAction } from "@/lib/staff-action-permissions";
import { prisma } from "@/lib/prisma";

export async function updateStaffPermissions(userId: string, formData: FormData) {
  const session = await requireFullAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, email: true } });
  if (!user || user.role !== "STAFF") {
    redirect("/admin/users");
  }

  const raw = formData.getAll("modules").map((v) => String(v));
  const modules = raw.filter((m): m is AdminModule =>
    ALL_ADMIN_MODULES.includes(m as AdminModule)
  );
  const canApproveTimeEntries = formData.get("canApproveTimeEntries") === "on";
  const projectsRaw = (formData.get("timeApproverProjectCodes") as string)?.trim();
  const timeApproverProjectCodes = projectsRaw
    ? projectsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 40)
    : [];

  const clientsRaw = (formData.get("timeApproverClientIds") as string)?.trim();
  const timeApproverClientIds = clientsRaw
    ? clientsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((id) => /^[a-z0-9]{20,}$/i.test(id))
        .slice(0, 80)
    : [];

  const deniedRaw = formData.getAll("deniedActions").map((v) => String(v));
  const staffDeniedActions = deniedRaw.filter((a): a is StaffAdminAction =>
    ALL_STAFF_ACTIONS.includes(a as StaffAdminAction)
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      staffAllowedModules: modules,
      staffDeniedActions,
      canApproveTimeEntries,
      timeApproverProjectCodes,
      timeApproverClientIds,
    },
  });

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "user.staff_permissions",
    entityType: "user",
    entityId: userId,
    summary: `Permessi staff aggiornati per ${user.email}`,
    metadata: { modules },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}/staff-permissions`);
  redirect("/admin/users");
}
