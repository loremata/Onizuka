import { buildFinanceEntryPdfBuffer, financeEntryPdfFilename } from "@/lib/finance-entry-pdf";

describe("finance-entry-pdf", () => {
  it("financeEntryPdfFilename sanitizes label", () => {
    expect(financeEntryPdfFilename("Fattura Marzo 2026!", "entry12345")).toMatch(/^onizuka-finance-fattura-marzo/);
    expect(financeEntryPdfFilename("Fattura Marzo 2026!", "entry12345")).toMatch(/\.pdf$/);
  });

  it("buildFinanceEntryPdfBuffer returns a PDF buffer", async () => {
    const buffer = await buildFinanceEntryPdfBuffer({
      entryId: "entry123",
      label: "Retainer social",
      type: "INCOME",
      status: "EXPECTED",
      amountEur: "1.500,00",
      clientName: "Demo Srl",
      clientVat: "IT12345678901",
      dueDate: "15 marzo 2026",
      paidAt: null,
      notes: "Pagamento trimestrale",
      invoiceNumber: "ONZ-2026-0001",
    });
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
