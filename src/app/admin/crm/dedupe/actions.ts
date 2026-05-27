"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { getClientMergeImpact } from "@/lib/client-merge-impact";
import { parseMergeFieldPicksFromForm } from "@/lib/client-merge-fields";
import { mergeClients } from "@/lib/client-merge";

export async function mergeClientsAction(
  targetId: string,
  sourceId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireFullAdmin();
  const picks = parseMergeFieldPicksFromForm(formData);
  const result = await mergeClients(targetId, sourceId, picks);
  if (result.ok) {
    revalidatePath("/admin/crm/dedupe");
    revalidatePath("/admin/clients");
    revalidatePath("/admin/search");
  }
  return result;
}

export async function getMergeImpactPairAction(
  targetId: string,
  sourceId: string
): Promise<
  | { ok: true; target: Awaited<ReturnType<typeof getClientMergeImpact>>; source: Awaited<ReturnType<typeof getClientMergeImpact>> }
  | { ok: false; error: string }
> {
  await requireFullAdmin();
  if (!targetId || !sourceId) return { ok: false, error: "Seleziona due anagrafiche." };
  if (targetId === sourceId) return { ok: false, error: "Sorgente e destinazione coincidono." };
  const [target, source] = await Promise.all([getClientMergeImpact(targetId), getClientMergeImpact(sourceId)]);
  return { ok: true, target, source };
}
