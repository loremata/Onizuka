import type { OutreachAbVariant } from "@/lib/outreach-ab";
import { normalizeAbVariant } from "@/lib/outreach-ab";
import { syncReachAbWinners } from "@/lib/reach-ab-sync";
import { prisma } from "@/lib/prisma";

/** Variante salvata dall'utente o calcolata dal vincitore A/B. */
export async function getOwnerReachAbDefaultVariant(
  ownerUserId: string
): Promise<OutreachAbVariant | null> {
  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { reachAbDefaultVariant: true },
  });
  const saved = user?.reachAbDefaultVariant?.trim().toUpperCase();
  if (saved === "A" || saved === "B") return saved;

  const latest = await prisma.outreachDraft.findFirst({
    where: { ownerUserId, abWinner: { in: ["A", "B"] } },
    orderBy: { updatedAt: "desc" },
    select: { abWinner: true },
  });
  if (latest?.abWinner === "A" || latest?.abWinner === "B") {
    return latest.abWinner;
  }

  return null;
}

/** Risolve variante per invio: esplicita > default owner > A. */
export async function resolveReachAbVariantForSend(
  ownerUserId: string,
  explicit: string | null | undefined
): Promise<OutreachAbVariant> {
  if (explicit != null && String(explicit).trim() !== "") {
    return normalizeAbVariant(explicit);
  }
  const def = await getOwnerReachAbDefaultVariant(ownerUserId);
  return def ?? "A";
}

/** Salva default da vincitore calcolato (sync + persist su User). */
export async function applyReachAbWinnerAsDefault(
  ownerUserId: string
): Promise<{ variant: OutreachAbVariant } | { error: string }> {
  const winner = await syncReachAbWinners(ownerUserId);
  if (!winner) {
    return { error: "Dati insufficienti per calcolare un vincitore (min. 3 invii per variante)." };
  }

  await prisma.user.update({
    where: { id: ownerUserId },
    data: { reachAbDefaultVariant: winner },
  });

  return { variant: winner as OutreachAbVariant };
}
