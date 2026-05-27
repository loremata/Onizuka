import { prisma } from "@/lib/prisma";

export type IntelligenceTrendDay = {
  day: string;
  created: number;
  dismissed: number;
  highPriority: number;
};

export async function loadIntelligenceTrends(
  ownerUserId: string,
  days = 30
): Promise<IntelligenceTrendDay[]> {
  const span = Math.min(120, Math.max(7, days));
  const since = new Date(Date.now() - span * 24 * 60 * 60 * 1000);

  const rows = await prisma.intelligenceRecommendation.findMany({
    where: { ownerUserId, createdAt: { gte: since } },
    select: { createdAt: true, dismissedAt: true, priority: true },
  });

  const timeline = new Map<string, IntelligenceTrendDay>();
  for (let i = span - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const k = d.toISOString().slice(0, 10);
    timeline.set(k, { day: k, created: 0, dismissed: 0, highPriority: 0 });
  }

  for (const r of rows) {
    const createdKey = r.createdAt.toISOString().slice(0, 10);
    const bucket = timeline.get(createdKey);
    if (bucket) {
      bucket.created += 1;
      if (r.priority === "high") bucket.highPriority += 1;
    }
    if (r.dismissedAt) {
      const dismissedKey = r.dismissedAt.toISOString().slice(0, 10);
      const dBucket = timeline.get(dismissedKey);
      if (dBucket) dBucket.dismissed += 1;
    }
  }

  return Array.from(timeline.values());
}
