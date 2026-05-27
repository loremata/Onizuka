"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { logWorkspaceAudit } from "@/lib/workspace-audit";
import { provisionWorkspaceDatabase, checkWorkspaceDatabaseHealth } from "@/lib/workspace-provision";
import {
  availableCloudProvisionProviders,
  provisionWorkspaceCloudDatabase,
  type CloudProvisionProvider,
} from "@/lib/workspace-cloud-provision";
import { prisma } from "@/lib/prisma";

export async function updateWorkspaceDatabaseUrl(
  workspaceId: string,
  databaseUrl: string | null
): Promise<{ error?: string }> {
  const session = await requireFullAdmin();
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!ws) return { error: "Workspace non trovato." };

  const trimmed = databaseUrl?.trim() || null;
  if (trimmed && !trimmed.startsWith("postgresql://")) {
    return { error: "URL deve iniziare con postgresql://" };
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { databaseUrl: trimmed },
  });

  void logWorkspaceAudit({
    workspaceId,
    actorUserId: session.user.id,
    action: "workspace.database_url",
    summary: trimmed ? "Impostato database dedicato workspace." : "Rimosso database dedicato.",
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/clients");
  return {};
}

export async function runWorkspaceDatabaseProvision(
  workspaceId: string
): Promise<{ error?: string; migratedAt?: string }> {
  await requireFullAdmin();
  const result = await provisionWorkspaceDatabase(workspaceId);
  if (!result.ok) return { error: result.error };
  return { migratedAt: result.migratedAt.toISOString() };
}

export async function probeWorkspaceDatabaseHealth(
  workspaceId: string
): Promise<{ ok: boolean; message: string }> {
  await requireFullAdmin();
  return checkWorkspaceDatabaseHealth(workspaceId);
}

export async function getCloudProvisionProvidersAction(): Promise<CloudProvisionProvider[]> {
  await requireFullAdmin();
  return availableCloudProvisionProviders();
}

export async function runWorkspaceCloudProvision(
  workspaceId: string,
  provider: CloudProvisionProvider
): Promise<{ error?: string; migratedAt?: string; provider?: string; cloudRef?: string }> {
  await requireFullAdmin();
  const result = await provisionWorkspaceCloudDatabase(workspaceId, provider);
  if (!result.ok) return { error: result.error };
  return {
    migratedAt: result.migratedAt.toISOString(),
    provider: result.provider,
    cloudRef: result.cloudRef,
  };
}
