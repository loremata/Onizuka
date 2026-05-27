/**
 * Sincronizza embedding[] → embeddingVector (pgvector).
 * Uso: npx tsx scripts/backfill-memory-pgvector.mjs [--limit=200]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 200);

async function main() {
  const items = await prisma.memoryItem.findMany({
    where: { embedding: { isEmpty: false } },
    select: { id: true, embedding: true },
    take: limit,
  });

  let ok = 0;
  let fail = 0;
  for (const item of items) {
    const literal = `[${item.embedding.join(",")}]`;
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "MemoryItem" SET "embeddingVector" = $1::vector WHERE id = $2`,
        literal,
        item.id
      );
      ok += 1;
    } catch {
      fail += 1;
    }
  }

  console.log(`pgvector sync: ${ok} ok, ${fail} fail (batch ${items.length})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
