/**
 * RF-02 — Analisi duplicati fiscali (SOLO LETTURA, nessuna scrittura DB).
 *
 * Uso:
 *   npx tsx scripts/audit-fiscal-duplicates.ts
 *   npm run fiscal:audit-duplicates
 *
 * Richiede DATABASE_URL (es. .env.local).
 */
import { PrismaClient } from "@prisma/client";
import { normalizeFiscalCode, normalizeVatNumber } from "../src/lib/client-kind";

const prisma = new PrismaClient();

type Row = { id: string; label: string; raw: string | null };

function groupByNorm<T extends Row>(
  rows: T[],
  normFn: (raw: string | null) => string | null
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const n = normFn(r.raw);
    if (!n) continue;
    const list = map.get(n) ?? [];
    list.push(r);
    map.set(n, list);
  }
  return map;
}

function printSection(title: string) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function printGroups(
  label: string,
  groups: Map<string, Row[]>,
  severity: "sicuro" | "probabile" | "manuale"
) {
  const dupes = Array.from(groups.entries()).filter(([, v]) => v.length > 1);
  if (dupes.length === 0) {
    console.log(`\n[${severity}] ${label}: nessun gruppo duplicato.`);
    return;
  }
  console.log(`\n[${severity}] ${label}: ${dupes.length} gruppi`);
  for (const [norm, items] of dupes) {
    console.log(`  · ${norm} (${items.length} record)`);
    for (const i of items) {
      console.log(`      - ${i.id} | ${i.label} | raw="${i.raw ?? ""}"`);
    }
  }
}

async function main() {
  console.log("Onizuka — audit fiscale duplicati (DRY-RUN)");
  console.log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "(DATABASE_URL mancante)"}`);
  console.log(`Data: ${new Date().toISOString()}`);

  const [clients, leads, people] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, companyName: true, vatNumber: true, fiscalCode: true },
    }),
    prisma.lead.findMany({
      select: {
        id: true,
        title: true,
        vatNumber: true,
        fiscalCode: true,
        convertedClientId: true,
      },
    }),
    prisma.person.findMany({
      select: { id: true, fullName: true, fiscalCode: true, ownerUserId: true },
    }),
  ]);

  printSection("1. Client — P.IVA duplicate (normalizzate)");
  const clientVat = groupByNorm(
    clients.map((c) => ({ id: c.id, label: c.companyName, raw: c.vatNumber })),
    normalizeVatNumber
  );
  printGroups("Client.vatNumber", clientVat, "sicuro");

  printSection("2. Client — Codice fiscale duplicate (normalizzate)");
  const clientCf = groupByNorm(
    clients.map((c) => ({ id: c.id, label: c.companyName, raw: c.fiscalCode })),
    normalizeFiscalCode
  );
  printGroups("Client.fiscalCode", clientCf, "sicuro");

  printSection("3. Person — CF duplicate per owner");
  const byOwner = new Map<string, typeof people>();
  for (const p of people) {
    const list = byOwner.get(p.ownerUserId) ?? [];
    list.push(p);
    byOwner.set(p.ownerUserId, list);
  }
  let personDupeGroups = 0;
  for (const [ownerId, list] of Array.from(byOwner.entries())) {
    const cfGroups = groupByNorm(
      list.map((p) => ({ id: p.id, label: p.fullName, raw: p.fiscalCode })),
      normalizeFiscalCode
    );
    const dupes = Array.from(cfGroups.entries()).filter(([, v]) => v.length > 1);
    if (dupes.length === 0) continue;
    personDupeGroups += dupes.length;
    console.log(`\n  Owner ${ownerId}: ${dupes.length} gruppi CF`);
    for (const [norm, items] of dupes) {
      console.log(`    · ${norm} (${items.length})`);
      for (const i of items) console.log(`        - ${i.id} | ${i.label}`);
    }
  }
  if (personDupeGroups === 0) console.log("\n[sicuro] Person.fiscalCode: nessun duplicato per owner.");

  printSection("4. Lead con stessa P.IVA di Client ma NON collegati");
  const clientByVat = new Map<string, (typeof clients)[0]>();
  for (const c of clients) {
    const v = normalizeVatNumber(c.vatNumber);
    if (v && !clientByVat.has(v)) clientByVat.set(v, c);
  }
  let unlink = 0;
  for (const l of leads) {
    const v = normalizeVatNumber(l.vatNumber);
    if (!v) continue;
    const client = clientByVat.get(v);
    if (!client) continue;
    if (l.convertedClientId === client.id) continue;
    unlink++;
    console.log(
      `  [collegare] lead ${l.id} «${l.title}» → client ${client.id} «${client.companyName}» (P.IVA ${v})`
    );
  }
  if (unlink === 0) console.log("  Nessun caso.");

  printSection("5. Lead collegati a Client con P.IVA diversa (incoerenti)");
  let incoherent = 0;
  for (const l of leads) {
    if (!l.convertedClientId) continue;
    const vLead = normalizeVatNumber(l.vatNumber);
    const client = clients.find((c) => c.id === l.convertedClientId);
    if (!client) continue;
    const vClient = normalizeVatNumber(client.vatNumber);
    if (vLead && vClient && vLead !== vClient) {
      incoherent++;
      console.log(
        `  [incoerente] lead ${l.id} VAT ${vLead} ≠ client ${client.id} VAT ${vClient} («${client.companyName}»)`
      );
    }
  }
  if (incoherent === 0) console.log("  Nessun caso.");

  printSection("6. Valori grezzi da normalizzare (vuoti / spazi / case)");
  let blankVat = 0;
  let blankCf = 0;
  let dirtyVat = 0;
  let dirtyCf = 0;
  for (const c of clients) {
    if (c.vatNumber != null && c.vatNumber.trim() === "") blankVat++;
    else if (c.vatNumber && normalizeVatNumber(c.vatNumber) !== c.vatNumber) dirtyVat++;
    if (c.fiscalCode != null && c.fiscalCode.trim() === "") blankCf++;
    else if (c.fiscalCode && normalizeFiscalCode(c.fiscalCode) !== c.fiscalCode) dirtyCf++;
  }
  for (const l of leads) {
    if (l.vatNumber != null && l.vatNumber.trim() === "") blankVat++;
    else if (l.vatNumber && normalizeVatNumber(l.vatNumber) !== l.vatNumber) dirtyVat++;
  }
  console.log(`  Client/Lead VAT vuoti da nullare: ${blankVat}`);
  console.log(`  Client/Lead VAT non normalizzati: ${dirtyVat}`);
  console.log(`  Client CF vuoti / non normalizzati: ${blankCf} / ${dirtyCf}`);

  printSection("7. Riepilogo — pronto per indici UNIQUE?");
  const clientVatDupes = Array.from(clientVat.values()).filter((v) => v.length > 1).length;
  const clientCfDupes = Array.from(clientCf.values()).filter((v) => v.length > 1).length;
  const ready = clientVatDupes === 0 && clientCfDupes === 0 && personDupeGroups === 0 && incoherent === 0;
  console.log(
    ready
      ? "  ✅ Nessun duplicato bloccante rilevato — si può valutare apply-fiscal-unique-indexes."
      : "  ⛔ Risolvere duplicati/incoerenze prima di applicare indici UNIQUE (RF-01)."
  );
  console.log(
    `  Gruppi: Client VAT=${clientVatDupes}, Client CF=${clientCfDupes}, Person CF=${personDupeGroups}, Lead incoerenti=${incoherent}, Lead da collegare=${unlink}`
  );

  console.log("\nFine audit (nessuna modifica al database).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
