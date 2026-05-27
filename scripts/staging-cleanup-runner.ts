/**
 * Cleanup record test staging/E2E/gate.
 */
import { PrismaClient } from "@prisma/client";
import { assertNotProductionDatabase } from "../src/lib/staging-guard";
import { getOnizukaEnv } from "../src/lib/onizuka-env";
import { loadStagingEnvFiles } from "./staging-env";
import { assertStagingEnvironment } from "../src/lib/staging-guard";

loadStagingEnvFiles();
if (getOnizukaEnv() === "staging") {
  assertStagingEnvironment({ requireStagingEnv: true, requireConfirm: true });
} else {
  assertNotProductionDatabase();
}

const prisma = new PrismaClient();

const PREFIXES = ["STAGING TEST", "ST02_", "E2E Audit CRM", "TEST lead-only", "TEST Lead ", "TEST quote "];

async function cleanupPrefix(prefix: string) {
  const [clients, leads, audits] = await Promise.all([
    prisma.client.findMany({
      where: { companyName: { startsWith: prefix } },
      select: { id: true },
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { businessName: { startsWith: prefix } },
          { title: { startsWith: prefix } },
          { notes: { startsWith: prefix } },
        ],
      },
      select: { id: true },
    }),
    prisma.digitalAudit.findMany({
      where: { businessName: { startsWith: prefix } },
      select: { id: true, clientId: true, leadId: true },
    }),
  ]);

  const clientIds = new Set(clients.map((c) => c.id));
  const leadIds = new Set(leads.map((l) => l.id));
  const auditIds = audits.map((a) => a.id);
  for (const a of audits) {
    if (a.clientId) clientIds.add(a.clientId);
    if (a.leadId) leadIds.add(a.leadId);
  }

  if (auditIds.length > 0) {
    await prisma.outreachDraft.deleteMany({ where: { digitalAuditId: { in: auditIds } } });
    const opps = await prisma.opportunity.findMany({
      where: { digitalAuditId: { in: auditIds } },
      select: { id: true },
    });
    for (const o of opps) {
      await prisma.opportunityQuote.deleteMany({ where: { opportunityId: o.id } });
      await prisma.opportunity.delete({ where: { id: o.id } }).catch(() => undefined);
    }
    await prisma.digitalAuditSection.deleteMany({ where: { digitalAuditId: { in: auditIds } } });
    await prisma.digitalAudit.deleteMany({ where: { id: { in: auditIds } } });
  }

  for (const leadId of Array.from(leadIds)) {
    await prisma.opportunityQuote.deleteMany({
      where: { opportunity: { leadId } },
    }).catch(() => undefined);
    await prisma.opportunity.deleteMany({ where: { leadId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }

  for (const clientId of Array.from(clientIds)) {
    await prisma.flowTask.deleteMany({ where: { relatedClientId: clientId } }).catch(() => undefined);
    await prisma.opportunity.deleteMany({ where: { clientId } }).catch(() => undefined);
    await prisma.client.delete({ where: { id: clientId } }).catch(() => undefined);
  }
}

async function main() {
  assertNotProductionDatabase();
  console.log("staging:cleanup — rimozione record test…");
  for (const prefix of PREFIXES) {
    await cleanupPrefix(prefix);
  }
  console.log("staging:cleanup done.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
