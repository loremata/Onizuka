"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { logAuditEvent } from "@/lib/admin-audit-log";
import { reencryptOwnerMemoryVault } from "@/lib/memory-key-rotation";

export async function reencryptMemoryVaultAction(): Promise<
  | { error: string }
  | { ok: true; processed: number; reencrypted: number; skipped: number }
> {
  const session = await requireAdminArea();
  const result = await reencryptOwnerMemoryVault(session.user.id);
  if (!result.ok) return { error: result.error };

  void logAuditEvent({
    actorUserId: session.user.id,
    action: "memory.vault.reencrypt",
    entityType: "memory",
    summary: `Rotazione chiave vault: ${result.reencrypted} voci ri-cifrate`,
    metadata: result,
  });

  revalidatePath("/admin/memory");
  return result;
}
