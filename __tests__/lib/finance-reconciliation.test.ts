import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";

jest.mock("@/lib/prisma", () => ({
  prisma: { financeEntry: { count: jest.fn() } },
}));
jest.mock("@/lib/finance-overdue", () => ({
  syncFinanceOverdueStatuses: jest.fn().mockResolvedValue(0),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma } = require("@/lib/prisma") as {
  prisma: { financeEntry: { count: jest.Mock } };
};

describe("loadFinanceReconciliation", () => {
  beforeEach(() => prisma.financeEntry.count.mockReset());

  it("registro coerente → healthy", async () => {
    // received_no_paid_at, paid_status_mismatch, overdue_income, received_month
    prisma.financeEntry.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3);

    const res = await loadFinanceReconciliation("u1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.report.healthy).toBe(true);
    expect(res.report.rows.map((r) => r.id)).toEqual([
      "received_no_paid_at",
      "paid_status_mismatch",
      "overdue_income",
      "received_month",
    ]);
    // Nessuna regola Stripe: i pagamenti sono fuori da Onizuka.
    expect(res.report.rows.some((r) => r.id.includes("stripe"))).toBe(false);
  });

  it("incassate senza paidAt → issue e non healthy", async () => {
    prisma.financeEntry.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const res = await loadFinanceReconciliation("u1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.report.healthy).toBe(false);
    const row = res.report.rows.find((r) => r.id === "received_no_paid_at");
    expect(row?.severity).toBe("issue");
    expect(row?.count).toBe(2);
  });
});
