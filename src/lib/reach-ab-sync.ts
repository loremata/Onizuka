import { prisma } from "@/lib/prisma";
import { suggestReachAbWinner } from "@/lib/outreach-ab";

/** Ricalcola `abWinner` sulle bozze A/B inviate dell'owner (batch leggero). */
export async function syncReachAbWinners(ownerUserId: string): Promise<string | null> {
  const [abSentA, abSentB, abOpenedA, abOpenedB, abClickedA, abClickedB] = await Promise.all([
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", abVariantSent: "A" },
    }),
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", abVariantSent: "B" },
    }),
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", abVariantSent: "A", openedAt: { not: null } },
    }),
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", abVariantSent: "B", openedAt: { not: null } },
    }),
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", abVariantSent: "A", clickedAt: { not: null } },
    }),
    prisma.outreachDraft.count({
      where: { ownerUserId, status: "SENT", abVariantSent: "B", clickedAt: { not: null } },
    }),
  ]);

  const winner = suggestReachAbWinner({
    abSentA,
    abSentB,
    abOpenRateA: abSentA > 0 ? Math.round((abOpenedA / abSentA) * 100) : 0,
    abOpenRateB: abSentB > 0 ? Math.round((abOpenedB / abSentB) * 100) : 0,
    abClickRateA: abSentA > 0 ? Math.round((abClickedA / abSentA) * 100) : 0,
    abClickRateB: abSentB > 0 ? Math.round((abClickedB / abSentB) * 100) : 0,
  });

  if (!winner) return null;

  await prisma.outreachDraft.updateMany({
    where: {
      ownerUserId,
      status: "SENT",
      OR: [{ subjectAlt: { not: null } }, { bodyAlt: { not: null } }],
    },
    data: { abWinner: winner },
  });

  return winner;
}
