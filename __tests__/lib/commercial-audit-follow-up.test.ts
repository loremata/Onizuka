import { loadAuditFollowUpSummary, auditFollowUpRowActions } from "@/lib/commercial-audit-follow-up";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: { findMany: jest.fn() },
    flowTask: { findMany: jest.fn() },
    outreachDraft: { findMany: jest.fn() },
    digitalAudit: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma");

describe("loadAuditFollowUpSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.opportunity.findMany.mockResolvedValue([]);
    prisma.flowTask.findMany.mockResolvedValue([]);
    prisma.outreachDraft.findMany.mockResolvedValue([]);
  });

  it("flags completed audit without opp, task or outreach", async () => {
    prisma.digitalAudit.findMany.mockResolvedValue([
      {
        id: "audit-1",
        businessName: "Rossi",
        overallScore: 40,
        leadId: "lead-1",
        clientId: null,
        recommendedService: { name: "SEO" },
      },
    ]);

    const summary = await loadAuditFollowUpSummary("owner-1", null, 10);
    expect(summary.withoutFollowUpTotal).toBe(1);
    expect(summary.criticalNoOpportunity).toBe(1);
    expect(summary.topGaps[0]?.auditId).toBe("audit-1");
  });

  it("excludes audit covered by open opportunity", async () => {
    prisma.digitalAudit.findMany.mockResolvedValue([
      {
        id: "audit-2",
        businessName: "Bianchi",
        overallScore: 30,
        leadId: null,
        clientId: "c1",
        recommendedService: null,
      },
    ]);
    prisma.opportunity.findMany.mockResolvedValue([{ digitalAuditId: "audit-2" }]);

    const summary = await loadAuditFollowUpSummary("owner-1", null, 10);
    expect(summary.withoutFollowUpTotal).toBe(0);
  });
});

describe("auditFollowUpRowActions", () => {
  it("links lead when present", () => {
    const a = auditFollowUpRowActions({
      auditId: "a1",
      title: "T",
      score: 50,
      kind: "party_no_action",
      leadId: "l1",
      clientId: null,
      recommendedServiceName: null,
    });
    expect(a.secondaryHref).toContain("leads/l1");
  });
});
