import { formatLeadsCsv, formatOpportunitiesCsv } from "@/lib/crm-export";
import { LeadStatus, OpportunityPriority, OpportunityStatus } from "@prisma/client";

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
        source: "web",
        status: LeadStatus.NEW,
        notes: null,
        ownerUserId: "u1",
        convertedClientId: null,
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
        assetId: null,
        ownerUserId: "u1",
        status: OpportunityStatus.OPEN,
        priority: OpportunityPriority.MEDIUM,
        estimatedValue: 1200,
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
