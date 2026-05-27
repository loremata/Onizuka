import { prisma } from "@/lib/prisma";

export function isPgvectorConfigured(): boolean {
  return process.env.ONIZUKA_PGVECTOR !== "0";
}

/** Sincronizza embedding float[] → colonna vector (best-effort). */
export async function syncMemoryPgvector(memoryId: string, vector: number[]): Promise<boolean> {
  if (!isPgvectorConfigured() || vector.length === 0) return false;

  const literal = `[${vector.join(",")}]`;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "MemoryItem" SET "embeddingVector" = $1::vector WHERE id = $2`,
      literal,
      memoryId
    );
    return true;
  } catch {
    return false;
  }
}

export type PgvectorHit = { id: string; score: number };

/** Ricerca ANN pgvector (cosine distance). */
export async function searchMemoryPgvector(
  ownerUserId: string,
  queryVector: number[],
  limit = 8
): Promise<PgvectorHit[]> {
  if (!isPgvectorConfigured() || queryVector.length === 0) return [];

  const literal = `[${queryVector.join(",")}]`;
  try {
    const rows = await prisma.$queryRawUnsafe<PgvectorHit[]>(
      `SELECT id, 1 - ("embeddingVector" <=> $1::vector) AS score
       FROM "MemoryItem"
       WHERE "ownerUserId" = $2
         AND "embeddingVector" IS NOT NULL
       ORDER BY "embeddingVector" <=> $1::vector
       LIMIT $3`,
      literal,
      ownerUserId,
      limit
    );
    return rows.filter((r) => r.score > 0.35);
  } catch {
    return [];
  }
}
