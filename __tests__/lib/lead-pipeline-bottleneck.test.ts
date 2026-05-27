import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "l1",
          title: "Foo",
          businessName: "Foo Srl",
          status: "NEW",
          updatedAt: new Date(Date.now() - 10 * 86400000),
        },
      ]),
    },
  },
}));

describe("lead-pipeline-bottleneck", () => {
  it("include lead oltre SLA", async () => {
    const items = await getLeadPipelineBottlenecks("owner-1", 10);
    expect(items.length).toBe(1);
    expect(items[0].leadId).toBe("l1");
    expect(items[0].priorityScore).toBeGreaterThan(0);
  });
});
