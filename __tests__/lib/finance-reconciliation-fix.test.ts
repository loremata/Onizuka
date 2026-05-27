import { applyFinanceReconciliationFix } from "@/lib/finance-reconciliation-fix";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    financeEntry: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock<{
  prisma: {
    financeEntry: {
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
}>("@/lib/prisma");

describe("finance-reconciliation-fix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets paidAt for received without date", async () => {
    prisma.financeEntry.findMany.mockResolvedValue([
      { id: "a", dueDate: new Date("2026-05-10") },
    ]);
    prisma.financeEntry.update.mockResolvedValue({});
    const res = await applyFinanceReconciliationFix("owner", "received_no_paid_at");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.fixed).toBe(1);
    expect(prisma.financeEntry.update).toHaveBeenCalled();
  });

  it("aligns status for paidAt mismatch", async () => {
    prisma.financeEntry.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });
    const res = await applyFinanceReconciliationFix("owner", "paid_status_mismatch");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.fixed).toBe(3);
  });
});
