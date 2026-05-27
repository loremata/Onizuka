/**
 * Backfill embedding OpenAI per voci memoria senza vettore.
 * Uso: npx tsx scripts/backfill-memory-embeddings.ts [--limit=100]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || process.env.ONIZUKA_EMBEDDINGS === "0") return null;

  const model = process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  const base = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const input = text.trim().slice(0, 8000);
  if (!input) return null;

  const res = await fetch(`${base.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  if (!res.ok) {
    console.error("Embedding API error:", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  return json.data?.[0]?.embedding ?? null;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 200;

  const all = await prisma.memoryItem.findMany({
    select: { id: true, title: true, content: true, embedding: true },
    orderBy: { updatedAt: "desc" },
    take: Math.min(limit * 3, 1500),
  });

  const pending = all.filter((i) => !i.embedding?.length).slice(0, limit);
  console.log(`Voci senza embedding: ${pending.length} (limite batch ${limit})`);

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("Imposta OPENAI_API_KEY.");
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (const item of pending) {
    const vector = await createEmbedding(`${item.title}\n\n${item.content}`);
    if (vector?.length) {
      await prisma.memoryItem.update({
        where: { id: item.id },
        data: { embedding: vector },
      });
      ok += 1;
      console.log(`OK ${item.id} · ${item.title.slice(0, 50)}`);
    } else {
      fail += 1;
      console.warn(`SKIP ${item.id}`);
    }
    await sleep(250);
  }

  console.log(`Completato: ${ok} indicizzate, ${fail} saltate.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
