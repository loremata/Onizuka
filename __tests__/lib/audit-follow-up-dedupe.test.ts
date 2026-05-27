import { createAuditFollowUpTasks } from "@/lib/audit-follow-up";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    flowTask: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma") as {
  prisma: { flowTask: { findFirst: jest.Mock; create: jest.Mock } };
};

describe("createAuditFollowUpTasks dedupe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.flowTask.create.mockImplementation(({ data }: { data: { title: string } }) =>
      Promise.resolve({ id: `t-${data.title.slice(0, 8)}` })
    );
  });

  it("skips duplicate follow-up task for same audit", async () => {
    prisma.flowTask.findFirst.mockImplementation(({ where }: { where: { title: { contains: string } } }) => {
      if (where.title.contains === "Follow-up commerciale post-audit") {
        return Promise.resolve({ id: "existing" });
      }
      return Promise.resolve(null);
    });

    const ids = await createAuditFollowUpTasks({
      ownerUserId: "u1",
      clientId: "c1",
      clientName: "Demo",
      auditId: "audit-1",
    });

    expect(ids.every((id) => id !== "existing")).toBe(true);
    const followUpCreates = prisma.flowTask.create.mock.calls.filter((c) =>
      String(c[0].data.title).includes("Follow-up commerciale post-audit")
    );
    expect(followUpCreates).toHaveLength(0);
  });
});
