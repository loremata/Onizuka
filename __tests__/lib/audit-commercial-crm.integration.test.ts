/**
 * Smoke integrazione DB locale (migration AP-02 + flusso commerciale).
 * Esegui con DATABASE_URL: npm test -- audit-commercial-crm.integration
 *
 * @jest-environment node
 */
import { PrismaClient } from "@prisma/client";
import { prepareAuditCommercialTarget } from "@/lib/audit-commercial-match";
import { ensureOpportunityFromDigitalAudit } from "@/lib/audit-opportunity-from-audit";
import { assertOpportunityParty } from "@/lib/opportunity-party";
import { normalizeWebsiteDomain } from "@/lib/audit-commercial-match";

const runIntegration = Boolean(process.env.DATABASE_URL?.trim());
const describeDb = runIntegration ? describe : describe.skip;

describeDb("audit commercial CRM smoke (local DB)", () => {
  const prisma = new PrismaClient();
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const createdClientIds: string[] = [];
  const createdLeadIds: string[] = [];
  const createdOppIds: string[] = [];
  const createdAuditIds: string[] = [];
  let ownerUserId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) throw new Error("Nessun utente ADMIN nel DB locale.");
    ownerUserId = admin.id;

    const cols = await prisma.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'Opportunity' AND column_name IN ('leadId', 'clientId')
    `;
    const leadCol = cols.find((c) => c.column_name === "leadId");
    const clientCol = cols.find((c) => c.column_name === "clientId");
    expect(leadCol).toBeDefined();
    expect(clientCol?.is_nullable).toBe("YES");
  });

  afterAll(async () => {
    for (const id of createdOppIds) {
      await prisma.opportunityQuote.deleteMany({ where: { opportunityId: id } }).catch(() => undefined);
      await prisma.opportunity.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdAuditIds) {
      await prisma.digitalAuditSection.deleteMany({ where: { digitalAuditId: id } }).catch(() => undefined);
      await prisma.digitalAudit.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdLeadIds) {
      await prisma.lead.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of createdClientIds) {
      await prisma.client.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("assertOpportunityParty accepts lead-only and client-only, rejects both or neither", () => {
    expect(assertOpportunityParty({ leadId: "l1" })).toBeNull();
    expect(assertOpportunityParty({ clientId: "c1" })).toBeNull();
    expect(assertOpportunityParty({ leadId: "l1", clientId: "c1" })).toMatch(/non entrambi/i);
    expect(assertOpportunityParty({})).toMatch(/cliente o un lead/i);
  });

  it("prepareAuditCommercialTarget creates new prospect for fresh VAT", async () => {
    const vat = `IT7${suffix.replace(/\D/g, "").padEnd(10, "0")}`.slice(0, 13);
    const target = await prepareAuditCommercialTarget({
      ownerUserId,
      vatNumber: vat,
      businessName: `Smoke ${suffix}`,
      acquisitionSource: "vat_form",
    });
    createdClientIds.push(target.clientId);
    if (target.leadId) createdLeadIds.push(target.leadId);
    expect(target.matchKind).toBe("new_prospect");
    expect(target.clientId).toBeTruthy();
    expect(target.leadId).toBeTruthy();
  });

  it("reuses client on second prepare with same VAT", async () => {
    const vat = `IT5${suffix.replace(/\D/g, "").padEnd(10, "0")}`.slice(0, 13);
    const first = await prepareAuditCommercialTarget({
      ownerUserId,
      vatNumber: vat,
      businessName: `Reuse ${suffix}`,
    });
    createdClientIds.push(first.clientId);
    if (first.leadId) createdLeadIds.push(first.leadId);

    const second = await prepareAuditCommercialTarget({
      ownerUserId,
      vatNumber: vat,
      businessName: `Reuse ${suffix}`,
    });
    expect(second.clientId).toBe(first.clientId);
    expect(second.matchKind).not.toBe("new_prospect");
  });

  it("creates lead-only opportunity when clientId omitted", async () => {
    const lead = await prisma.lead.create({
      data: {
        ownerUserId,
        title: `Lead-only opp ${suffix}`,
        businessName: `Lead Opp ${suffix}`,
        status: "QUALIFIED",
        source: "smoke_test",
        commercialProspectStage: "AUDIT_IN_PROGRESS",
        clientMacroCategory: "DIGITAL_AI",
      },
    });
    createdLeadIds.push(lead.id);

    const service = await prisma.commercialService.findFirst({
      select: { id: true },
    });
    if (!service) throw new Error("Catalogo servizi commerciale mancante (eseguire seed).");

    const audit = await prisma.digitalAudit.create({
      data: {
        ownerUserId,
        leadId: lead.id,
        businessName: lead.businessName,
        status: "COMPLETED",
        overallScore: 42,
        priorityProblem: "Smoke test",
        recommendedServiceId: service.id,
      },
    });
    createdAuditIds.push(audit.id);

    const opp = await ensureOpportunityFromDigitalAudit({
      ownerUserId,
      auditId: audit.id,
      leadId: lead.id,
    });
    expect(opp?.opportunityId).toBeTruthy();
    if (opp?.opportunityId) {
      createdOppIds.push(opp.opportunityId);
      const row = await prisma.opportunity.findUniqueOrThrow({
        where: { id: opp.opportunityId },
        select: { leadId: true, clientId: true, source: true, digitalAuditId: true },
      });
      expect(row.leadId).toBe(lead.id);
      expect(row.clientId).toBeNull();
      expect(row.source).toBe("DIGITAL_AUDIT");
      expect(row.digitalAuditId).toBe(audit.id);
    }
  });

  it("normalizeWebsiteDomain handles www and trailing slash", () => {
    expect(normalizeWebsiteDomain("HTTPS://WWW.Esempio.IT/")).toBe("esempio.it");
    expect(normalizeWebsiteDomain("http://esempio.it")).toBe("esempio.it");
  });
});
