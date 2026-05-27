import { prisma } from "@/lib/prisma";
import { refreshIntelligenceRecommendations } from "@/lib/intelligence-nba";

export async function refreshIntelligenceForAllAdmins(): Promise<{
  owners: number;
  created: number;
}> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 30,
  });

  let created = 0;
  for (const a of admins) {
    created += await refreshIntelligenceRecommendations(a.id);
  }

  return { owners: admins.length, created };
}
