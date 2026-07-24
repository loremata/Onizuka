import { formatFinanceEntriesCsv } from "@/lib/finance-export";

describe("formatFinanceEntriesCsv", () => {
  it("includes header and row", () => {
    const csv = formatFinanceEntriesCsv([
      {
        id: "1",
        ownerUserId: "u",
        clientId: null,
        assetId: null,
        type: "INCOME",
        status: "EXPECTED",
        label: "Fattura Rossi",
        amountEur: { toString: () => "1500" } as never,
        recurringMonthly: false,
        renewalDate: null,
        invoiceNumber: null,
        dueDate: new Date("2026-05-01"),
        paidAt: null,
        sdiExportedAt: null,
        stripeCheckoutSessionId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: { companyName: "Rossi S.r.l." },
      },
    ]);
    expect(csv).toContain("Etichetta");
    expect(csv).toContain("Fattura Rossi");
    expect(csv).toContain("Rossi S.r.l.");
  });
});
