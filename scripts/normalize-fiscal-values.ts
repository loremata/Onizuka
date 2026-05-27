/**
 * RF-02 — Backfill normalizzazione valori fiscali (opzionale).
 * Default: dry-run. Con --execute aggiorna solo Client, Lead, Person.
 *
 *   npx tsx scripts/normalize-fiscal-values.ts
 *   npx tsx scripts/normalize-fiscal-values.ts --execute
 */
import { PrismaClient } from "@prisma/client";
import { normalizeFiscalCode, normalizeVatNumber } from "../src/lib/client-kind";

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");

function normVat(raw: string | null): string | null {
  if (raw == null) return null;
  if (raw.trim() === "") return null;
  return normalizeVatNumber(raw);
}

function normCf(raw: string | null): string | null {
  if (raw == null) return null;
  if (raw.trim() === "") return null;
  return normalizeFiscalCode(raw);
}

async function main() {
  let clientUpdates = 0;
  let leadUpdates = 0;
  let personUpdates = 0;

  const clients = await prisma.client.findMany({
    select: { id: true, vatNumber: true, fiscalCode: true },
  });
  for (const c of clients) {
    const vatNumber = normVat(c.vatNumber);
    const fiscalCode = normCf(c.fiscalCode);
    if (vatNumber === c.vatNumber && fiscalCode === c.fiscalCode) continue;
    clientUpdates++;
    if (execute) {
      await prisma.client.update({
        where: { id: c.id },
        data: { vatNumber, fiscalCode },
      });
    }
  }

  const leads = await prisma.lead.findMany({
    select: { id: true, vatNumber: true, fiscalCode: true },
  });
  for (const l of leads) {
    const vatNumber = normVat(l.vatNumber);
    const fiscalCode = normCf(l.fiscalCode);
    if (vatNumber === l.vatNumber && fiscalCode === l.fiscalCode) continue;
    leadUpdates++;
    if (execute) {
      await prisma.lead.update({
        where: { id: l.id },
        data: { vatNumber, fiscalCode },
      });
    }
  }

  const people = await prisma.person.findMany({
    select: { id: true, fiscalCode: true },
  });
  for (const p of people) {
    const fiscalCode = normCf(p.fiscalCode);
    if (fiscalCode === p.fiscalCode) continue;
    personUpdates++;
    if (execute) {
      await prisma.person.update({
        where: { id: p.id },
        data: { fiscalCode },
      });
    }
  }

  console.log(execute ? "EXECUTE" : "DRY-RUN");
  console.log(`Client da aggiornare: ${clientUpdates}`);
  console.log(`Lead da aggiornare: ${leadUpdates}`);
  console.log(`Person da aggiornare: ${personUpdates}`);
  if (!execute && clientUpdates + leadUpdates + personUpdates > 0) {
    console.log("\nEsegui con --execute dopo backup e audit duplicati.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
