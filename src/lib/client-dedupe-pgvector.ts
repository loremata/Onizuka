import { prisma } from "@/lib/prisma";
import { isPgvectorConfigured } from "@/lib/memory-pgvector";

export type ClientDedupePgHit = {
  clientAId: string;
  clientBId: string;
  companyA: string;
  companyB: string;
  score: number;
};

/** Sincronizza float[] → colonna vector su Client. */
export async function syncClientDedupePgvector(clientId: string, vector: number[]): Promise<boolean> {
  if (!isPgvectorConfigured() || vector.length === 0) return false;
  const literal = `[${vector.join(",")}]`;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Client" SET "dedupeEmbeddingVector" = $1::vector WHERE id = $2`,
      literal,
      clientId
    );
    return true;
  } catch {
    return false;
  }
}

/** Coppie duplicate via ANN pgvector (soglia score ≥ 0.88). */
export async function findClientDedupePairsPgvector(limit = 40): Promise<ClientDedupePgHit[]> {
  if (!isPgvectorConfigured()) return [];

  try {
    const rows = await prisma.$queryRawUnsafe<
      { id_a: string; id_b: string; company_a: string; company_b: string; score: number }[]
    >(
      `SELECT a.id AS id_a, b.id AS id_b, a."companyName" AS company_a, b."companyName" AS company_b,
              1 - (a."dedupeEmbeddingVector" <=> b."dedupeEmbeddingVector") AS score
       FROM "Client" a
       JOIN "Client" b ON a.id < b.id
       WHERE a."dedupeEmbeddingVector" IS NOT NULL
         AND b."dedupeEmbeddingVector" IS NOT NULL
         AND 1 - (a."dedupeEmbeddingVector" <=> b."dedupeEmbeddingVector") >= 0.88
       ORDER BY score DESC
       LIMIT $1`,
      limit
    );
    return rows.map((r) => ({
      clientAId: r.id_a,
      clientBId: r.id_b,
      companyA: r.company_a,
      companyB: r.company_b,
      score: Math.round(Number(r.score) * 100),
    }));
  } catch {
    return [];
  }
}
