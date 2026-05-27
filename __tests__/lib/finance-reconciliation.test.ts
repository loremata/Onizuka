import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    financeEntry: {
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/finance-overdue", () => ({
  syncFinanceOverdueStatuses: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/stripe-client", () => ({
  isStripeConfigured: jest.fn(() => true),
}));

jest.mock("@/lib/with-db", () => ({
  runWithDb: async (fn: () => Promise<unknown>) => ({ ok: true, data: await fn() }),
}));

const { prisma } = jest.requireMock<{ prisma: { financeEntry: { count: jest.Mock } } }>(
  "@/lib/prisma"
);

describe("finance-reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.financeEntry.count.mockResolvedValue(0);
  });

  it("returns healthy report when all counts are zero", async () => {
    const result = await loadFinanceReconciliation("owner-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.healthy).toBe(true);
    expect(result.report.stripeEnabled).toBe(true);
    expect(result.report.rows.some((r) => r.id === "stripe_open")).toBe(true);
  });

  it("flags issues when received entries lack paidAt", async () => {
    prisma.financeEntry.count.mockImplementation(async (args: { where?: { paidAt?: unknown } }) => {
      if (args.where?.paidAt === null) return 2;
      return 0;
    });
    const result = await loadFinanceReconciliation("owner-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.healthy).toBe(false);
    const row = result.report.rows.find((r) => r.id === "received_no_paid_at");
    expect(row?.count).toBe(2);
    expect(row?.severity).toBe("issue");
  });
});
