"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/admin-session";
import { upsertOfficialProgress } from "@/lib/inserimenti/official-progress";

/** Numero all'italiana ("6,5") → number. Stringa vuota = niente valore. */
function num(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const x = parseFloat(s.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : null;
}

/**
 * Salva (o corregge) l'avanzamento comunicato dal gestore per una data.
 * Idempotente: risalvare la stessa data sovrascrive, non duplica.
 *
 * Le quantità arrivano come stringhe perché il form le raccoglie all'italiana
 * ("6,5"): la conversione sta qui, in un punto solo. Quantità vuota = quella
 * pista non compare nell'avanzamento (e se c'era, viene tolta).
 */
export async function saveOfficialProgress(input: {
  month: string;
  asOfDate: string;
  rows: { lineKey: string; qty: string; domiciledQty?: string; breakdown?: string }[];
}): Promise<{ error: string } | { saved: number; removed: number }> {
  const session = await requireFullAdmin();

  if (!/^\d{4}-\d{2}$/.test(input.month)) return { error: "Mese non valido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOfDate)) return { error: "Inserisci la data dell'avanzamento." };
  if (input.asOfDate.slice(0, 7) !== input.month) {
    return { error: "La data dell'avanzamento deve stare dentro il mese che stai guardando." };
  }

  const rows = input.rows.map((r) => ({
    lineKey: r.lineKey,
    qty: num(r.qty),
    domiciledQty: num(r.domiciledQty),
    breakdown: r.breakdown ?? null,
  }));

  if (rows.every((r) => r.qty == null)) {
    return { error: "Scrivi almeno una quantità: senza numeri non c'è avanzamento da salvare." };
  }

  try {
    const res = await upsertOfficialProgress({
      ownerUserId: session.user.id,
      brand: "TIM",
      month: input.month,
      asOfDate: input.asOfDate,
      rows,
    });
    revalidatePath("/admin/inserimenti/avanzamento");
    revalidatePath("/admin/inserimenti/gara-tim");
    revalidatePath("/admin/inserimenti");
    return { saved: res.saved, removed: res.removed };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Non sono riuscito a salvare l'avanzamento." };
  }
}
