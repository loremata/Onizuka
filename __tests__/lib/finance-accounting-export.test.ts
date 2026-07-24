import { formatFinanceAccountingCsv } from "@/lib/finance-accounting-export";
import { resolveAccountingAccount } from "@/lib/finance-accounting-accounts";

describe("finance-accounting-export", () => {
  it("suggests revenue account for income received", () => {
    expect(resolveAccountingAccount("INCOME", "RECEIVED")).toBe("5810");
    expect(resolveAccountingAccount("EXPENSE", "PAID")).toBe("6805");
  });

  it("exports gestionale columns with dare/avere", () => {
    const csv = formatFinanceAccountingCsv([
      {
        id: "fe-1",
        ownerUserId: "u",
        clientId: null,
        assetId: null,
        type: "INCOME",
        status: "RECEIVED",
        label: "Consulenza maggio",
        amountEur: { toString: () => "1200.5" } as never,
        recurringMonthly: false,
        renewalDate: null,
        invoiceNumber: "FT-2026-12",
        dueDate: new Date("2026-05-15"),
        paidAt: new Date("2026-05-20"),
        sdiExportedAt: null,
        stripeCheckoutSessionId: "cs_test",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: { companyName: "Rossi S.r.l.", accountingCode: "4105123" },
      },
    ]);
    expect(csv).toContain("4105123");
    expect(csv).toContain("Data_scadenza");
    expect(csv).toContain("AVERE");
    expect(csv).toContain("Consulenza maggio");
    expect(csv).toContain("FT-2026-12");
    expect(csv).toContain("cs_test");
  });
});
