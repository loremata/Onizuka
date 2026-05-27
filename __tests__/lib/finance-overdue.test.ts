import { syncFinanceOverdueStatuses } from "@/lib/finance-overdue";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    financeEntry: {
      updateMany: jest.fn(),
    },
  },
}));

describe("syncFinanceOverdueStatuses", () => {
  it("marks past-due open entries as OVERDUE", async () => {
    (prisma.financeEntry.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    const n = await syncFinanceOverdueStatuses("user-1");
    expect(n).toBe(2);
    expect(prisma.financeEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerUserId: "user-1", status: { in: ["PLANNED", "EXPECTED"] } }),
        data: { status: "OVERDUE" },
      })
    );
  });
});
