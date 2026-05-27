"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import {
  applyFinanceReconciliationFix,
  type ReconciliationFixId,
} from "@/lib/finance-reconciliation-fix";

const FIX_IDS: ReconciliationFixId[] = ["received_no_paid_at", "paid_status_mismatch"];

export async function runFinanceReconciliationFix(
  fixId: string
): Promise<{ ok: true; fixed: number } | { ok: false; error: string }> {
  const session = await requireFullAdmin();

  if (!FIX_IDS.includes(fixId as ReconciliationFixId)) {
    return { ok: false, error: "Azione non valida." };
  }

  const result = await applyFinanceReconciliationFix(
    session.user.id,
    fixId as ReconciliationFixId
  );

  if (result.ok) {
    revalidatePath("/admin/finance");
    revalidatePath("/admin/insights");
    revalidatePath("/admin");
    revalidatePath("/admin/go-live");
  }

  return result;
}
