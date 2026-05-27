import { prisma } from "@/lib/prisma";
import { syncMemoryItemEmbedding } from "@/lib/memory-embedding";
import { isEmbeddingConfigured } from "@/lib/llm-client";

export type MemoryReindexResult = {
  processed: number;
  indexed: number;
  skipped: number;
};

/** Re-indicizza embedding per voci memoria senza vettore (max `limit`). */
export async function reindexMemoryEmbeddings(
  ownerUserId: string,
  limit = 40
): Promise<MemoryReindexResult> {
  if (!isEmbeddingConfigured()) {
    return { processed: 0, indexed: 0, skipped: 0 };
  }

  const items = await prisma.memoryItem.findMany({
    where: { ownerUserId },
    select: { id: true, embedding: true },
    orderBy: { updatedAt: "desc" },
    take: limit * 3,
  });

  const pending = items.filter((i) => !i.embedding?.length).slice(0, limit);
  let indexed = 0;
  let skipped = 0;

  for (const item of pending) {
    try {
      await syncMemoryItemEmbedding(item.id);
      const check = await prisma.memoryItem.findUnique({
        where: { id: item.id },
        select: { embedding: true },
      });
      if (check?.embedding?.length) indexed += 1;
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }

  return { processed: pending.length, indexed, skipped };
}

export async function countMemoryEmbeddingStats(ownerUserId: string): Promise<{
  total: number;
  withEmbedding: number;
}> {
  const [total, withEmbedding] = await Promise.all([
    prisma.memoryItem.count({ where: { ownerUserId } }),
    prisma.memoryItem.count({
      where: { ownerUserId, embedding: { isEmpty: false } },
    }),
  ]);
  return { total, withEmbedding };
}
