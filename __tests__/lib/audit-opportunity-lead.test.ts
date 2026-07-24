import { ensureOpportunityFromDigitalAudit } from "@/lib/audit-opportunity-from-audit";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    digitalAudit: { findFirst: jest.fn() },
    opportunity: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    opportunityQuote: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma") as {
  prisma: {
    digitalAudit: { findFirst: jest.Mock };
    opportunity: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
    opportunityQuote: { findFirst: jest.Mock; create: jest.Mock };
  };
};

describe("ensureOpportunityFromDigitalAudit with leadId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates opportunity with leadId only when no client", async () => {
    prisma.digitalAudit.findFirst.mockResolvedValue({
      overallScore: 40,
      priorityProblem: "Sito assente",
      businessName: "Bar",
      clientId: null,
      leadId: "lead-1",
      client: null,
      lead: { businessName: "Bar", title: "Lead" },
      recommendedService: { id: "s1", name: "Sito", slug: "website" },
      recommendedBrand: { name: "Lab" },
      sections: [{ sectionKey: "WEBSITE", score: 20 }],
    });
    prisma.opportunity.findFirst.mockResolvedValue(null);
    prisma.opportunity.create.mockResolvedValue({ id: "opp-1" });
    prisma.opportunityQuote.findFirst.mockResolvedValue(null);
    prisma.opportunityQuote.create.mockResolvedValue({ id: "q1" });

    const result = await ensureOpportunityFromDigitalAudit({
      ownerUserId: "u1",
      auditId: "a1",
      leadId: "lead-1",
    });

    expect(result?.opportunityId).toBe("opp-1");
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "lead-1",
          clientId: null,
          digitalAuditId: "a1",
          source: "DIGITAL_AUDIT",
        }),
      })
    );
  });

  it("does not duplicate for same auditId", async () => {
    prisma.digitalAudit.findFirst.mockResolvedValue({
      overallScore: 50,
      recommendedService: { name: "SEO", slug: "seo" },
      recommendedBrand: null,
      sections: [],
      client: { companyName: "X" },
      lead: null,
    });
    prisma.opportunity.findFirst.mockResolvedValue({ id: "opp-existing", status: "OPEN", leadId: null, clientId: "c1" });
    prisma.opportunity.update.mockResolvedValue({});
    prisma.opportunityQuote.findFirst.mockResolvedValue({ id: "q0" });

    const result = await ensureOpportunityFromDigitalAudit({
      ownerUserId: "u1",
      auditId: "a1",
      clientId: "c1",
    });

    expect(result?.updated).toBe(true);
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });
});

// La sync massiva post-conversione (ex syncOpportunitiesOnLeadConversion) oggi vive
// inline nella server action di conversione lead (src/app/admin/crm/leads/actions.ts:
// opportunity.updateMany where { leadId, clientId: null }). Qui verifichiamo l'intento
// equivalente rimasto in questo modulo: quando arriva il cliente, l'opportunità del
// lead passa al cliente e il leadId viene azzerato (esclusione mutua).
describe("passaggio lead→cliente sull'opportunità dell'audit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("aggiorna l'opportunità del lead con clientId e azzera leadId", async () => {
    prisma.digitalAudit.findFirst.mockResolvedValue({
      overallScore: 45,
      priorityProblem: null,
      businessName: "Bar",
      clientId: null,
      leadId: "lead-1",
      client: { companyName: "Bar Srl" },
      lead: { businessName: "Bar", title: "Lead" },
      recommendedService: { id: "s1", name: "Sito", slug: "website" },
      recommendedBrand: null,
      sections: [],
    });
    prisma.opportunity.findFirst.mockResolvedValue({
      id: "opp-1",
      status: "OPEN",
      leadId: "lead-1",
      clientId: null,
    });
    prisma.opportunity.update.mockResolvedValue({});
    prisma.opportunityQuote.findFirst.mockResolvedValue({ id: "q0" });

    const result = await ensureOpportunityFromDigitalAudit({
      ownerUserId: "u1",
      auditId: "a1",
      clientId: "client-1",
    });

    expect(result?.updated).toBe(true);
    expect(prisma.opportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "opp-1" },
        data: expect.objectContaining({ clientId: "client-1", leadId: null }),
      })
    );
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });
});
