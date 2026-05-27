import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { provisionWorkspaceDatabase, type WorkspaceProvisionResult } from "@/lib/workspace-provision";
import { createRdsTenantDatabase, isRdsTenantProvisionEnabled } from "@/lib/workspace-cloud-rds";
import {
  createSupabaseTenantProject,
  isSupabaseCloudProvisionEnabled,
} from "@/lib/workspace-cloud-supabase";

export type CloudProvisionProvider = "supabase" | "rds";

export function availableCloudProvisionProviders(): CloudProvisionProvider[] {
  const out: CloudProvisionProvider[] = [];
  if (isSupabaseCloudProvisionEnabled()) out.push("supabase");
  if (isRdsTenantProvisionEnabled()) out.push("rds");
  return out;
}

function randomDbPassword(): string {
  return randomBytes(18).toString("base64url");
}

/** Crea DB tenant su cloud + salva URL workspace + migrate deploy. */
export async function provisionWorkspaceCloudDatabase(
  workspaceId: string,
  provider: CloudProvisionProvider
): Promise<WorkspaceProvisionResult & { provider?: string; cloudRef?: string }> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, slug: true, name: true },
  });
  if (!ws) return { ok: false, error: "Workspace non trovato." };

  let databaseUrl: string;
  let cloudRef: string | null = null;

  if (provider === "supabase") {
    const created = await createSupabaseTenantProject({
      name: `onizuka-${ws.slug}`,
      dbPassword: randomDbPassword(),
    });
    if ("error" in created) return { ok: false, error: created.error };
    databaseUrl = created.databaseUrl;
    cloudRef = created.ref;
  } else {
    const created = await createRdsTenantDatabase(ws.slug);
    if ("error" in created) return { ok: false, error: created.error };
    databaseUrl = created.databaseUrl;
    cloudRef = created.databaseName;
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      databaseUrl,
      databaseCloudProvider: provider,
      databaseCloudRef: cloudRef,
    },
  });

  const migrated = await provisionWorkspaceDatabase(workspaceId);
  if (!migrated.ok) return migrated;
  return { ...migrated, provider, cloudRef: cloudRef ?? undefined };
}
