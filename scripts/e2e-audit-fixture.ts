/**
 * CLI per fixture E2E audit (invocato da Playwright via tsx).
 * Uso: npx tsx scripts/e2e-audit-fixture.ts run-vat '{"vatNumber":"...","businessName":"..."}'
 *      npx tsx scripts/e2e-audit-fixture.ts run-domain '{"website":"...","businessName":"..."}'
 *      npx tsx scripts/e2e-audit-fixture.ts cleanup '{"businessNamePrefix":"E2E Audit CRM"}'
 */
import { PrismaClient, type ClientMacroCategory } from "@prisma/client";
import { runDigitalAuditByVat } from "../src/lib/digital-audit-run";
import { runDigitalAuditUnified } from "../src/lib/audit-commercial-entry";

const DIGITAL_AI: ClientMacroCategory = "DIGITAL_AI";

const prisma = new PrismaClient();

async function adminId() {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@agency.com", role: "ADMIN" },
    select: { id: true },
  });
  if (admin) return admin.id;
  const fallback = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!fallback) throw new Error("Nessun ADMIN nel DB.");
  return fallback.id;
}

async function cleanup(opts: {
  businessNamePrefix?: string;
  clientIds?: string[];
  leadIds?: string[];
  auditIds?: string[];
}) {
  const clientIds = new Set(opts.clientIds ?? []);
  const leadIds = new Set(opts.leadIds ?? []);
  const auditIds = new Set(opts.auditIds ?? []);

  if (opts.businessNamePrefix) {
    const [clients, leads, audits] = await Promise.all([
      prisma.client.findMany({
        where: { companyName: { startsWith: opts.businessNamePrefix } },
        select: { id: true },
      }),
      prisma.lead.findMany({
        where: { businessName: { startsWith: opts.businessNamePrefix } },
        select: { id: true },
      }),
      prisma.digitalAudit.findMany({
        where: { businessName: { startsWith: opts.businessNamePrefix } },
        select: { id: true, clientId: true, leadId: true },
      }),
    ]);
    for (const c of clients) clientIds.add(c.id);
    for (const l of leads) leadIds.add(l.id);
    for (const a of audits) {
      auditIds.add(a.id);
      if (a.clientId) clientIds.add(a.clientId);
      if (a.leadId) leadIds.add(a.leadId);
    }
  }

  const auditIdList = Array.from(auditIds);
  const clientIdList = Array.from(clientIds);
  const leadIdList = Array.from(leadIds);

  if (auditIdList.length > 0) {
    await prisma.outreachDraft.deleteMany({ where: { digitalAuditId: { in: auditIdList } } });
    const opps = await prisma.opportunity.findMany({
      where: { digitalAuditId: { in: auditIdList } },
      select: { id: true },
    });
    for (const o of opps) {
      await prisma.opportunityQuote.deleteMany({ where: { opportunityId: o.id } });
      await prisma.opportunity.delete({ where: { id: o.id } }).catch(() => undefined);
    }
    if (clientIdList.length > 0) {
      await prisma.flowTask.deleteMany({ where: { relatedClientId: { in: clientIdList } } });
    }
    await prisma.digitalAuditSection.deleteMany({ where: { digitalAuditId: { in: auditIdList } } });
    await prisma.digitalAudit.deleteMany({ where: { id: { in: auditIdList } } });
  }

  for (const leadId of leadIdList) {
    await prisma.opportunity.deleteMany({ where: { leadId } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }

  for (const clientId of clientIdList) {
    await prisma.opportunity.deleteMany({ where: { clientId } }).catch(() => undefined);
    await prisma.client.delete({ where: { id: clientId } }).catch(() => undefined);
  }
}

async function readPayload(): Promise<Record<string, unknown>> {
  const arg = process.argv[3];
  if (arg) return JSON.parse(arg) as Record<string, unknown>;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

async function main() {
  const [cmd] = process.argv.slice(2);
  const payload = await readPayload();

  try {
    if (cmd === "run-vat") {
      const ownerUserId = await adminId();
      const result = await runDigitalAuditByVat({
        ownerUserId,
        vatNumber: String(payload.vatNumber),
        website: payload.website ? String(payload.website) : undefined,
        businessName: String(payload.businessName),
        createOutreachDraft: Boolean(payload.createOutreachDraft),
      });
      const client = await prisma.client.findUnique({
        where: { id: result.clientId },
        select: { companyName: true },
      });
      const lead =
        result.leadId != null
          ? await prisma.lead.findUnique({
              where: { id: result.leadId },
              select: { businessName: true, title: true },
            })
          : null;
      const opportunity = await prisma.opportunity.findFirst({
        where: { digitalAuditId: result.auditId },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      });
      console.log(
        JSON.stringify({
          auditId: result.auditId,
          clientId: result.clientId,
          clientCompanyName: client?.companyName ?? undefined,
          leadId: result.leadId,
          leadBusinessName: lead?.businessName ?? lead?.title ?? undefined,
          opportunityId: opportunity?.id,
          opportunityTitle: opportunity?.title,
          vat: payload.vatNumber,
          businessName: payload.businessName,
          ownerUserId,
        })
      );
      return;
    }

    if (cmd === "run-domain") {
      const ownerUserId = await adminId();
      const website = String(payload.website);
      const businessName = String(payload.businessName);
      // Dominio-only sul form: audit possibile se il dominio matcha un client esistente (CM-01).
      const slug = `e2e-domain-${Date.now().toString(36)}`;
      await prisma.client.create({
        data: {
          companyName: businessName,
          website,
          slug,
          contactEmail: `${slug}@example.test`,
          status: "LEAD_QUALIFIED",
          clientMacroCategory: DIGITAL_AI,
        },
      });
      const result = await runDigitalAuditUnified({
        ownerUserId,
        website,
        businessName,
        acquisitionSource: "vat_form",
        createOutreachDraft: false,
      });
      const client = await prisma.client.findUnique({
        where: { id: result.clientId },
        select: { companyName: true },
      });
      const opportunity = await prisma.opportunity.findFirst({
        where: { digitalAuditId: result.auditId },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      });
      console.log(
        JSON.stringify({
          auditId: result.auditId,
          clientId: result.clientId,
          leadId: result.leadId,
          clientCompanyName: client?.companyName ?? undefined,
          opportunityId: opportunity?.id,
          opportunityTitle: opportunity?.title,
          vat: "",
          businessName: payload.businessName,
          ownerUserId,
        })
      );
      return;
    }

    if (cmd === "cleanup") {
      await cleanup({
        businessNamePrefix: payload.businessNamePrefix
          ? String(payload.businessNamePrefix)
          : undefined,
        clientIds: payload.clientIds as string[] | undefined,
        leadIds: payload.leadIds as string[] | undefined,
        auditIds: payload.auditIds as string[] | undefined,
      });
      console.log(JSON.stringify({ ok: true }));
      return;
    }

    throw new Error(`Comando sconosciuto: ${cmd}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
