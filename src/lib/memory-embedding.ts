import { prisma } from "@/lib/prisma";
import { createEmbedding } from "@/lib/llm-client";
import { readMemoryContentPlain } from "@/lib/memory-crypto";
import { searchMemoryPgvector, syncMemoryPgvector } from "@/lib/memory-pgvector";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

/** Aggiorna embedding su create/update memoria (best-effort). */
export async function syncMemoryItemEmbedding(memoryId: string): Promise<void> {
  const item = await prisma.memoryItem.findUnique({
    where: { id: memoryId },
    select: { id: true, title: true, content: true },
  });
  if (!item) return;

  const vector = await createEmbedding(`${item.title}\n\n${item.content}`);
  if (!vector?.length) return;

  await prisma.memoryItem.update({
    where: { id: memoryId },
    data: { embedding: vector },
  });
}

export type SemanticMemoryHit = {
  id: string;
  score: number;
};

/** Ricerca semantica su voci con embedding (max `take` candidati recenti). */
export async function searchMemoryByEmbedding(
  ownerUserId: string,
  query: string,
  limit = 6
): Promise<SemanticMemoryHit[]> {
  const queryVector = await createEmbedding(query);
  if (!queryVector?.length) return [];

  const pgHits = await searchMemoryPgvector(ownerUserId, queryVector, limit);
  if (pgHits.length > 0) return pgHits;

  const candidates = await prisma.memoryItem.findMany({
    where: {
      ownerUserId,
      embedding: { isEmpty: false },
    },
    select: { id: true, embedding: true },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  const ranked = candidates
    .map((c) => ({
      id: c.id,
      score: cosineSimilarity(queryVector, c.embedding),
    }))
    .filter((r) => r.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked;
}
