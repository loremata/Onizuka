import { formatLeadsCsv, formatOpportunitiesCsv } from "@/lib/crm-export";
import { LeadStatus, OpportunityPriority, OpportunityStatus, Prisma } from "@prisma/client";

describe("crm-export", () => {
  it("formats leads csv with titolo and azienda", () => {
    const csv = formatLeadsCsv([
      {
        id: "l1",
        title: "Contatto sito",
        contactName: "Mario",
        businessName: "Acme Srl",
        email: "m@acme.it",
        phone: null,
        vatNumber: null,
        fiscalCode: null,
        clientMacroCategory: null,
        commercialProspectStage: null,
        source: "web",
        referrerId: null,
        status: LeadStatus.NEW,
        notes: null,
        ownerUserId: "u1",
        convertedClientId: null,
        clientId: null,
        website: null,
        city: null,
        googlePlaceId: null,
        createdAt: new Date(),
        updatedAt: new Date("2026-05-15T10:00:00.000Z"),
        convertedClient: { companyName: "Acme Client" },
      },
    ]);
    expect(csv.split("\n")[0]).toContain("titolo");
    expect(csv).toContain("Contatto sito");
    expect(csv).toContain("Acme Srl");
  });

  it("formats opportunities csv", () => {
    const csv = formatOpportunitiesCsv([
      {
        id: "o1",
        title: "Renewal",
        clientId: "c1",
        leadId: null,
        assetId: null,
        ownerUserId: "u1",
        source: null,
        digitalAuditId: null,
        status: OpportunityStatus.OPEN,
        priority: OpportunityPriority.MEDIUM,
        estimatedValue: new Prisma.Decimal(1200),
        probability: 50,
        description: null,
        nextAction: "Call",
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date("2026-05-15T10:00:00.000Z"),
        client: { companyName: "Cliente Demo" },
        asset: null,
      },
    ]);
    expect(csv).toContain("Cliente Demo");
    expect(csv).toContain("Renewal");
  });
});
