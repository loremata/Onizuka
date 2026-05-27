import { createEmbedding, isEmbeddingConfigured } from "@/lib/llm-client";
import { computeLocalClientEmbedding, isLocalDedupeMlEnabled } from "@/lib/client-dedupe-local-ml";
import { refreshDedupeModelWeightsCache } from "@/lib/dedupe-model-weights";

let weightsLoaded = false;
async function ensureDedupeWeightsLoaded(): Promise<void> {
  if (weightsLoaded) return;
  weightsLoaded = true;
  await refreshDedupeModelWeightsCache();
}
import { findClientDedupePairsPgvector } from "@/lib/client-dedupe-pgvector";
import { cosineSimilarity } from "@/lib/memory-embedding";
import { isPgvectorConfigured } from "@/lib/memory-pgvector";
import { prisma } from "@/lib/prisma";

export type EmbeddingDuplicatePair = {
  clientAId: string;
  clientBId: string;
  companyA: string;
  companyB: string;
  score: number;
};

function clientEmbedText(c: {
  companyName: string;
  contactEmail: string;
  vatNumber: string | null;
  phone: string | null;
}): string {
  return [c.companyName, c.contactEmail, c.vatNumber ?? "", c.phone ?? ""].filter(Boolean).join(" | ");
}

/** Coppie anagrafiche simili via embedding (pgvector ANN se attivo, altrimenti float[] / on-the-fly). */
export async function findEmbeddingDuplicatePairs(limit = 40): Promise<EmbeddingDuplicatePair[]> {
  if (isLocalDedupeMlEnabled()) await ensureDedupeWeightsLoaded();
  if (isPgvectorConfigured()) {
    const pg = await findClientDedupePairsPgvector(limit);
    if (pg.length > 0) return pg;
  }
  if (!isEmbeddingConfigured() && !isLocalDedupeMlEnabled()) return [];

  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      vatNumber: true,
      phone: true,
      dedupeEmbedding: true,
    },
  });

  const vectors: { id: string; companyName: string; v: number[] }[] = [];
  for (const c of clients) {
    const stored = c.dedupeEmbedding?.length ? c.dedupeEmbedding : null;
    let emb: number[] | null = stored;
    if (!emb?.length) {
      if (isLocalDedupeMlEnabled()) {
        emb = computeLocalClientEmbedding(clientEmbedText(c));
      } else if (isEmbeddingConfigured()) {
        emb = (await createEmbedding(clientEmbedText(c))) ?? null;
      }
    }
    if (emb?.length) vectors.push({ id: c.id, companyName: c.companyName, v: emb });
  }

  const pairs: EmbeddingDuplicatePair[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const score = cosineSimilarity(vectors[i]!.v, vectors[j]!.v);
      if (score >= 0.88) {
        const a = vectors[i]!;
        const b = vectors[j]!;
        pairs.push({
          clientAId: a.id,
          clientBId: b.id,
          companyA: a.companyName,
          companyB: b.companyName,
          score: Math.round(score * 100),
        });
      }
    }
  }

  return pairs.sort((x, y) => y.score - x.score).slice(0, limit);
}
