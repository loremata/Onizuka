import { formatFinanceDoubleEntryCsv } from "@/lib/finance-accounting-export";

describe("formatFinanceDoubleEntryCsv", () => {
  it("emits dare and avere rows per entry", () => {
    const csv = formatFinanceDoubleEntryCsv([
      {
        id: "fe-1",
        ownerUserId: "u",
        clientId: null,
        assetId: null,
        type: "INCOME",
        status: "RECEIVED",
        label: "Fattura test",
        amountEur: { toString: () => "500" } as never,
        invoiceNumber: null,
        dueDate: new Date("2026-05-01"),
        paidAt: new Date("2026-05-02"),
        sdiExportedAt: null,
        stripeCheckoutSessionId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: null,
      },
    ]);
    expect(csv).toContain("Registrazione_ID");
    expect(csv).toContain("Dare_EUR");
    expect(csv).toContain("Avere_EUR");
    expect(csv).toContain("fe-1");
    const lines = csv.trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });
});
