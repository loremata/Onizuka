import { parseCommercialDashboardFilters, periodToSince, filtersToSearchParams } from "@/lib/commercial-dashboard-filters";
import { loadCommercialDashboard } from "@/lib/commercial-dashboard";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { count: jest.fn(), findMany: jest.fn() },
    client: { count: jest.fn() },
    opportunity: { count: jest.fn(), findMany: jest.fn() },
    flowTask: { count: jest.fn(), findMany: jest.fn() },
    digitalAudit: { count: jest.fn(), findMany: jest.fn() },
    auditSheetQueueItem: { count: jest.fn() },
    outreachDraft: { count: jest.fn() },
    opportunityQuote: { count: jest.fn() },
  },
}));

jest.mock("@/lib/with-db", () => ({
  runWithDb: async (fn: () => Promise<unknown>) => ({ ok: true, data: await fn() }),
}));

jest.mock("@/lib/finance-overdue", () => ({
  loadFinanceOverdueEntries: jest.fn(async () => ({
    rows: [{ id: "f1", label: "Fattura", clientName: "Demo", amountEur: "100" }],
    totalEur: 100,
  })),
}));

jest.mock("@/lib/retail-contract-renewals", () => ({
  loadUpcomingRetailRenewals: jest.fn(async () => [
    { id: "r1", clientName: "C", label: "Retail", daysUntil: 20, href: "/admin/clients/x" },
  ]),
}));

jest.mock("@/lib/client-commercial-gaps", () => ({
  summarizeCommercialGapsForDashboard: jest.fn(async () => ({
    totalWithGap: 3,
    top: [{ clientId: "c-gap", companyName: "Gap Co", missingCount: 7 }],
    scanLimit: 48,
  })),
  loadRecommendedServiceNotProposed: jest.fn(async () => [
    {
      auditId: "a-svc",
      businessName: "Svc Audit",
      serviceName: "SEO",
      leadId: "l1",
      clientId: null,
    },
  ]),
}));

jest.mock("@/lib/commercial-audit-follow-up", () => ({
  loadAuditFollowUpSummary: jest.fn(async () => ({
    withoutFollowUpTotal: 4,
    noCommercialTask: 2,
    criticalNoOpportunity: 1,
    partyNoAction: 1,
    isolated: 0,
    topGaps: [
      {
        auditId: "a-gap",
        title: "No FU",
        score: 42,
        kind: "critical_no_opportunity",
        leadId: null,
        clientId: null,
        recommendedServiceName: null,
      },
    ],
    sampleSize: 10,
  })),
  auditFollowUpRowActions: jest.fn(() => ({
    href: "/admin/audit/digital/a-gap",
    actionLabel: "Apri audit",
  })),
}));

jest.mock("@/lib/day-bounds", () => ({
  resolveRecapDayBounds: () => ({
    start: new Date("2026-05-20T00:00:00"),
    end: new Date("2026-05-20T23:59:59"),
    timeZoneLabel: "Europe/Rome",
  }),
}));

const { prisma } = jest.requireMock("@/lib/prisma");
const { loadFinanceOverdueEntries } = jest.requireMock("@/lib/finance-overdue");
const { loadUpcomingRetailRenewals } = jest.requireMock("@/lib/retail-contract-renewals");

describe("parseCommercialDashboardFilters", () => {
  it("defaults to 30 day period", () => {
    const f = parseCommercialDashboardFilters({});
    expect(f.period).toBe("30");
    expect(f.incompleteOnly).toBe(false);
  });

  it("parses multiple filters", () => {
    const f = parseCommercialDashboardFilters({
      period: "7",
      incomplete: "1",
      leadStatus: "QUALIFIED",
      oppPriority: "HIGH",
      oppSource: "DIGITAL_AUDIT",
      auditMax: "45",
    });
    expect(f.period).toBe("7");
    expect(f.incompleteOnly).toBe(true);
    expect(f.leadStatus).toBe("QUALIFIED");
    expect(f.opportunityPriority).toBe("HIGH");
    expect(f.opportunitySource).toBe("DIGITAL_AUDIT");
    expect(f.auditScoreMax).toBe(45);
  });

  it("serializes filters to search params", () => {
    const q = filtersToSearchParams({
      period: "7",
      incompleteOnly: true,
      leadStatus: "NEW",
      opportunityPriority: "HIGH",
      opportunitySource: "DIGITAL_AUDIT",
      auditScoreMax: 45,
    });
    expect(q).toContain("period=7");
    expect(q).toContain("incomplete=1");
    expect(q).toContain("leadStatus=NEW");
    expect(q).toContain("oppPriority=HIGH");
    expect(q).toContain("auditMax=45");
  });
});

describe("periodToSince", () => {
  it("returns null for all", () => {
    expect(periodToSince("all")).toBeNull();
  });
});

describe("loadCommercialDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.lead.count.mockResolvedValue(10);
    prisma.client.count.mockResolvedValue(5);
    prisma.opportunity.count.mockResolvedValue(3);
    prisma.opportunity.findMany.mockResolvedValue([]);
    prisma.flowTask.count.mockResolvedValue(0);
    prisma.flowTask.findMany.mockResolvedValue([]);
    prisma.digitalAudit.count.mockResolvedValue(2);
    prisma.digitalAudit.findMany.mockResolvedValue([]);
    prisma.auditSheetQueueItem.count.mockResolvedValue(1);
    prisma.outreachDraft.count.mockResolvedValue(0);
    prisma.opportunityQuote.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
  });

  it("returns lead-only and client-only opportunity KPIs", async () => {
    prisma.opportunity.count.mockImplementation(
      async (args: { where?: { clientId?: null; leadId?: null } }) => {
        const w = args?.where;
        if (w?.clientId === null && w?.leadId && "not" in w.leadId) return 2;
        if (w?.clientId === null && w?.leadId === null) return 1;
        return 5;
      }
    );

    const result = await loadCommercialDashboard("owner-1", "Europe/Rome", {
      period: "30",
      incompleteOnly: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kpis.find((k) => k.id === "opp-lead")?.value).toBe(2);
    expect(result.data.kpis.find((k) => k.id === "opp-orphan")?.value).toBe(1);
    expect(result.data.dataHygiene.some((r) => r.id === "hygiene-opp-orphan")).toBe(true);
  });

  it("includes audit without follow-up and finance KPIs", async () => {
    const result = await loadCommercialDashboard("owner-1", null, {
      period: "30",
      incompleteOnly: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kpis.find((k) => k.id === "audit-no-followup")?.value).toBe(4);
    expect(result.data.kpis.find((k) => k.id === "finance-overdue")?.value).toBe(1);
    expect(result.data.kpis.find((k) => k.id === "commercial-gap")?.value).toBe(3);
    expect(result.data.renewals30).toBe(1);
    expect(loadFinanceOverdueEntries).toHaveBeenCalledWith("owner-1", 5);
    expect(loadUpcomingRetailRenewals).toHaveBeenCalledWith("owner-1", 90);
  });

  it("shows leads without VAT and sheet domain KPI", async () => {
    prisma.lead.count.mockImplementation(async (args: { where?: { vatNumber?: null } }) => {
      if (args?.where?.vatNumber === null) return 7;
      return 10;
    });
    prisma.auditSheetQueueItem.count.mockResolvedValue(2);

    const result = await loadCommercialDashboard("owner-1", null, {
      period: "all",
      incompleteOnly: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kpis.find((k) => k.id === "leads-no-vat")?.value).toBe(7);
    expect(result.data.kpis.find((k) => k.id === "sheet-domain")?.value).toBe(2);
  });

  it("filters incomplete KPIs only", async () => {
    prisma.lead.count.mockImplementation(async (args: { where?: { vatNumber?: null } }) => {
      if (args?.where?.vatNumber === null) return 2;
      return 10;
    });

    const result = await loadCommercialDashboard("owner-1", null, {
      period: "30",
      incompleteOnly: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.data.kpis.map((k) => k.id);
    expect(ids).toContain("leads-no-vat");
    expect(ids).not.toContain("leads");
  });

  it("handles empty database gracefully", async () => {
    prisma.lead.count.mockResolvedValue(0);
    prisma.client.count.mockResolvedValue(0);
    prisma.opportunity.count.mockResolvedValue(0);

    const result = await loadCommercialDashboard("owner-1", null, {
      period: "all",
      incompleteOnly: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.today).toEqual([]);
    expect(result.data.pipelineWeightedEur).toBeDefined();
  });

  it("does not throw on orphan opportunity in list", async () => {
    prisma.opportunity.findMany.mockResolvedValue([
      {
        id: "orphan-1",
        title: "Orfana",
        priority: "MEDIUM",
        nextAction: null,
        estimatedValue: null,
        source: null,
        digitalAuditId: null,
        client: null,
        lead: null,
      },
    ]);

    const result = await loadCommercialDashboard("owner-1", null, {
      period: "30",
      incompleteOnly: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.opportunities[0]?.subtitle).toContain("orfana");
  });
});
