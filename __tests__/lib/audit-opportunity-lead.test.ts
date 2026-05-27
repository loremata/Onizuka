import {
  ensureOpportunityFromDigitalAudit,
  syncOpportunitiesOnLeadConversion,
} from "@/lib/audit-opportunity-from-audit";

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

describe("syncOpportunitiesOnLeadConversion", () => {
  it("updates opportunities with clientId", async () => {
    prisma.opportunity.updateMany.mockResolvedValue({ count: 2 });
    const n = await syncOpportunitiesOnLeadConversion("lead-1", "client-1");
    expect(n).toBe(2);
    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: { leadId: "lead-1" },
      data: { clientId: "client-1" },
    });
  });
});
