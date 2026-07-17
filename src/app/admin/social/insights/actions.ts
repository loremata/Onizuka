"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/admin-session";
import { generateAndStoreInsights } from "@/lib/social-insights-store";

export async function regenerateInsights(
  clientId: string,
  _prev: unknown,
  _formData: FormData
): Promise<{ ok: true; aiGenerated: boolean } | { error: string }> {
  await requireAdminArea();
  if (!clientId) return { error: "Nessun cliente selezionato." };

  try {
    const panel = await generateAndStoreInsights(clientId);
    revalidatePath("/admin/social/insights");
    return { ok: true, aiGenerated: panel.aiGenerated };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generazione non riuscita." };
  }
}
