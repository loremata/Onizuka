import { nextFinanceInvoiceNumber } from "@/lib/finance-invoice-number";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    financeEntry: {
      findFirst: jest.fn().mockResolvedValue({ invoiceNumber: "ONZ-2026-0007" }),
    },
  },
}));

describe("finance-invoice-number", () => {
  it("increments sequence for current year", async () => {
    const n = await nextFinanceInvoiceNumber("owner1");
    expect(n).toMatch(/^ONZ-\d{4}-0008$/);
  });
});
