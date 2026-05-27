/**
 * Verifica indici fiscali UNIQUE su PostgreSQL (solo lettura).
 * npx tsx scripts/verify-fiscal-indexes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPECTED = [
  "Client_vatNumber_norm_unique",
  "Client_fiscalCode_norm_unique",
  "Person_owner_fiscalCode_norm_unique",
];

async function main() {
  const rows = await prisma.$queryRaw<
    { indexname: string; indexdef: string }[]
  >`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY(${EXPECTED})
    ORDER BY indexname
  `;

  console.log("Indici fiscali attivi:\n");
  for (const name of EXPECTED) {
    const row = rows.find((r) => r.indexname === name);
    if (!row) {
      console.log(`  ❌ MANCANTE: ${name}`);
      continue;
    }
    const partial = row.indexdef.includes("WHERE");
    const unique = row.indexdef.toUpperCase().includes("UNIQUE");
    console.log(`  ✅ ${name}`);
    console.log(`     UNIQUE=${unique} PARTIAL=${partial}`);
    console.log(`     ${row.indexdef}\n`);
  }

  if (rows.length !== EXPECTED.length) {
    process.exit(1);
  }
}

main()
  .finally(() => prisma.$disconnect());
