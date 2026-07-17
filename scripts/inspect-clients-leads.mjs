// READ-ONLY: elenca clienti e lead per distinguere test da reali. Nessuna scrittura.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fmt(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

const clients = await prisma.client.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    companyName: true,
    contactEmail: true,
    status: true,
    relationshipState: true,
    kind: true,
    vatNumber: true,
    fiscalCode: true,
    createdAt: true,
    _count: {
      select: {
        opportunities: true,
        assets: true,
        contacts: true,
        retailContracts: true,
        commercialServices: true,
        users: true,
        tickets: true,
      },
    },
  },
});

console.log(`\n===== CLIENTI (${clients.length}) =====`);
for (const c of clients) {
  const rel = c._count;
  const links = Object.entries(rel)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(
    `[${c.relationshipState}|${c.status}] ${c.companyName}\n` +
      `    id=${c.id} email=${c.contactEmail} kind=${c.kind} piva=${c.vatNumber ?? "—"} cf=${c.fiscalCode ?? "—"} creato=${fmt(c.createdAt)}\n` +
      `    collegati: ${links || "(nessuno)"}`
  );
}

const leads = await prisma.lead.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    title: true,
    businessName: true,
    email: true,
    vatNumber: true,
    commercialProspectStage: true,
    createdAt: true,
    convertedClient: { select: { id: true, companyName: true } },
    _count: { select: { opportunities: true, digitalAudits: true, outreachDrafts: true } },
  },
});

console.log(`\n===== LEAD table (${leads.length}) =====`);
for (const l of leads) {
  const conv = l.convertedClient ? ` -> convertito in cliente "${l.convertedClient.companyName}"` : "";
  const links = Object.entries(l._count).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(
    `[${l.commercialProspectStage ?? "—"}] ${l.businessName ?? l.title ?? "(senza nome)"}` +
      ` — id=${l.id} email=${l.email ?? "—"} piva=${l.vatNumber ?? "—"} creato=${fmt(l.createdAt)}${conv} ${links}`
  );
}

await prisma.$disconnect();
