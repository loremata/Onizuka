/**
 * RF-01 — Applica indici UNIQUE parziali solo se l'audit non segnala duplicati.
 *
 * Default: dry-run (nessuna modifica).
 *   npx tsx scripts/apply-fiscal-unique-indexes.ts
 *   npx tsx scripts/apply-fiscal-unique-indexes.ts --execute
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { normalizeFiscalCode, normalizeVatNumber } from "../src/lib/client-kind";

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");

async function hasBlockingDuplicates(): Promise<boolean> {
  const [clients, people] = await Promise.all([
    prisma.client.findMany({ select: { id: true, vatNumber: true, fiscalCode: true } }),
    prisma.person.findMany({ select: { id: true, ownerUserId: true, fiscalCode: true } }),
  ]);

  const vatMap = new Map<string, number>();
  for (const c of clients) {
    const v = normalizeVatNumber(c.vatNumber);
    if (!v) continue;
    vatMap.set(v, (vatMap.get(v) ?? 0) + 1);
  }
  if (Array.from(vatMap.values()).some((n) => n > 1)) return true;

  const cfMap = new Map<string, number>();
  for (const c of clients) {
    const f = normalizeFiscalCode(c.fiscalCode);
    if (!f) continue;
    cfMap.set(f, (cfMap.get(f) ?? 0) + 1);
  }
  if (Array.from(cfMap.values()).some((n) => n > 1)) return true;

  const personMap = new Map<string, number>();
  for (const p of people) {
    const f = normalizeFiscalCode(p.fiscalCode);
    if (!f) continue;
    const key = `${p.ownerUserId}:${f}`;
    personMap.set(key, (personMap.get(key) ?? 0) + 1);
  }
  return Array.from(personMap.values()).some((n) => n > 1);
}

async function main() {
  console.log(execute ? "Modalità: EXECUTE" : "Modalità: DRY-RUN");

  if (await hasBlockingDuplicates()) {
    console.error("⛔ Duplicati rilevati. Esegui prima: npm run fiscal:audit-duplicates");
    console.error("   Risolvi con /admin/crm/dedupe o script manuali, poi riprova.");
    process.exit(1);
  }

  const sqlPath = join(process.cwd(), "prisma", "sql", "fiscal-unique-indexes.sql");
  const sql = readFileSync(sqlPath, "utf8");
  console.log("SQL da applicare:\n", sql);

  if (!execute) {
    console.log("\nNessuna modifica. Aggiungi --execute per creare gli indici.");
    return;
  }

  const statements = sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);

  console.log(`\nApplicazione ${statements.length} indici…`);
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("✅ Indici UNIQUE parziali applicati.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
