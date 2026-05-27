import { getOpportunityPipelineBottlenecks } from "@/lib/opportunity-pipeline-bottleneck";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    opportunity: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "opp-1",
          title: "Renewal Q2",
          status: "OPEN",
          updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          dueDate: null,
          client: { companyName: "Acme" },
        },
        {
          id: "opp-2",
          title: "Fresh",
          status: "OPEN",
          updatedAt: new Date(),
          dueDate: null,
          client: { companyName: "Beta" },
        },
      ]),
    },
  },
}));

describe("getOpportunityPipelineBottlenecks", () => {
  it("returns only opportunities beyond SLA", async () => {
    const items = await getOpportunityPipelineBottlenecks("user-1", 10);
    expect(items).toHaveLength(1);
    expect(items[0]?.opportunityId).toBe("opp-1");
    expect(items[0]?.clientName).toBe("Acme");
    expect(items[0]?.priorityScore).toBeGreaterThan(0);
  });
});
