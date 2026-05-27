import { ensureDraftQuoteFromDigitalAudit } from "@/lib/draft-quote-from-audit";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    digitalAudit: { findFirst: jest.fn() },
    opportunityQuote: { findFirst: jest.fn(), create: jest.fn() },
    opportunity: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma") as {
  prisma: {
    digitalAudit: { findFirst: jest.Mock };
    opportunityQuote: { findFirst: jest.Mock; create: jest.Mock };
    opportunity: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
};

describe("ensureDraftQuoteFromDigitalAudit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when audit has no recommended service", async () => {
    prisma.digitalAudit.findFirst.mockResolvedValue({
      recommendedService: null,
      recommendedBrand: null,
      client: { companyName: "Demo" },
      sections: [],
      overallScore: 40,
    });

    const result = await ensureDraftQuoteFromDigitalAudit({
      ownerUserId: "u1",
      clientId: "c1",
      auditId: "a1",
    });
    expect(result).toBeNull();
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("reuses opportunity already linked to auditId", async () => {
    prisma.digitalAudit.findFirst.mockResolvedValue({
      recommendedService: { name: "SEO", slug: "seo" },
      recommendedBrand: { name: "LabSeven" },
      client: { companyName: "Demo Srl" },
      lead: null,
      clientId: "c1",
      leadId: null,
      sections: [{ sectionKey: "SEO", score: 20 }],
      overallScore: 42,
      priorityProblem: "SEO debole",
    });
    prisma.opportunity.findFirst.mockResolvedValueOnce({ id: "opp-audit" });
    prisma.opportunity.update.mockResolvedValue({});
    prisma.opportunityQuote.findFirst.mockResolvedValue({ id: "q-existing" });

    const result = await ensureDraftQuoteFromDigitalAudit({
      ownerUserId: "u1",
      clientId: "c1",
      auditId: "a1",
    });
    expect(result).toEqual({ quoteId: "q-existing", opportunityId: "opp-audit" });
    expect(prisma.opportunity.create).not.toHaveBeenCalled();
  });

  it("creates opportunity with DIGITAL_AUDIT source when none exists", async () => {
    prisma.digitalAudit.findFirst.mockResolvedValue({
      recommendedService: { name: "Gestione social", slug: "social-mgmt" },
      recommendedBrand: { name: "StudioPop" },
      client: { companyName: "Bar Srl" },
      sections: [{ sectionKey: "SOCIAL", score: 25 }],
      overallScore: 38,
      priorityProblem: "Social assenti",
    });
    prisma.opportunity.findFirst.mockResolvedValue(null);
    prisma.opportunity.create.mockResolvedValue({ id: "opp-new" });
    prisma.opportunityQuote.findFirst.mockResolvedValue(null);
    prisma.opportunityQuote.create.mockResolvedValue({ id: "q-new" });

    const result = await ensureDraftQuoteFromDigitalAudit({
      ownerUserId: "u1",
      clientId: "c1",
      auditId: "audit-99",
    });

    expect(result).toEqual({ quoteId: "q-new", opportunityId: "opp-new" });
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "c1",
          source: "DIGITAL_AUDIT",
          digitalAuditId: "audit-99",
          status: "OPEN",
        }),
      })
    );
  });
});
