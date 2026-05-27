/**
 * Imposta sentAt = updatedAt per bozze già SENT senza timestamp.
 * Uso: npx tsx scripts/backfill-outreach-sent-at.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.outreachDraft.findMany({
    where: { status: "SENT", sentAt: null },
    select: { id: true, updatedAt: true },
  });

  let n = 0;
  for (const row of rows) {
    await prisma.outreachDraft.update({
      where: { id: row.id },
      data: { sentAt: row.updatedAt },
    });
    n += 1;
  }
  console.log(`Backfill sentAt: ${n} bozze aggiornate.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
