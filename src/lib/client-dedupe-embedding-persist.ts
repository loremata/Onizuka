import { createEmbedding, isEmbeddingConfigured } from "@/lib/llm-client";
import { computeLocalClientEmbedding, isLocalDedupeMlEnabled } from "@/lib/client-dedupe-local-ml";
import { syncClientDedupePgvector } from "@/lib/client-dedupe-pgvector";
import { prisma } from "@/lib/prisma";

async function embeddingForText(text: string): Promise<number[] | null> {
  if (isLocalDedupeMlEnabled()) {
    return computeLocalClientEmbedding(text);
  }
  if (isEmbeddingConfigured()) {
    return (await createEmbedding(text)) ?? null;
  }
  return computeLocalClientEmbedding(text);
}

function clientEmbedText(c: {
  companyName: string;
  contactEmail: string;
  vatNumber: string | null;
  phone: string | null;
}): string {
  return [c.companyName, c.contactEmail, c.vatNumber ?? "", c.phone ?? ""].filter(Boolean).join(" | ");
}

/** Calcola e salva `Client.dedupeEmbedding` (OpenAI). */
export async function syncClientDedupeEmbedding(clientId: string): Promise<{ ok: true } | { error: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      vatNumber: true,
      phone: true,
    },
  });
  if (!client) return { error: "Cliente non trovato." };

  const emb = await embeddingForText(clientEmbedText(client));
  if (!emb?.length) return { error: "Embedding non generato." };

  await prisma.client.update({
    where: { id: clientId },
    data: { dedupeEmbedding: emb },
  });
  await syncClientDedupePgvector(clientId, emb);
  return { ok: true };
}

/** Backfill batch (max `limit` clienti senza embedding o più vecchi). */
export async function backfillClientDedupeEmbeddings(limit = 50): Promise<{
  processed: number;
  errors: string[];
}> {
  const clients = await prisma.client.findMany({
    where: { dedupeEmbedding: { equals: [] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      companyName: true,
      contactEmail: true,
      vatNumber: true,
      phone: true,
    },
  });

  const errors: string[] = [];
  let processed = 0;
  for (const c of clients) {
    const emb = await embeddingForText(clientEmbedText(c));
    if (!emb?.length) {
      errors.push(`${c.id}: embedding vuoto`);
      continue;
    }
    await prisma.client.update({
      where: { id: c.id },
      data: { dedupeEmbedding: emb },
    });
    await syncClientDedupePgvector(c.id, emb);
    processed += 1;
  }
  return { processed, errors };
}
