"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function updateDedupeAlertThreshold(formData: FormData) {
  const session = await requireFullAdmin();
  const raw = (formData.get("dedupeAlertMinGroups") as string)?.trim();
  let dedupeAlertMinGroups: number | null = null;
  if (raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      return { ok: false as const, error: "Soglia non valida (1–999)." };
    }
    dedupeAlertMinGroups = Math.round(n);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { dedupeAlertMinGroups },
  });

  revalidatePath("/admin/crm/dedupe");
  return { ok: true as const };
}
