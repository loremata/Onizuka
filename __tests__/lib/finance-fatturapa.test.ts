import { buildFatturaPaXml } from "@/lib/finance-fatturapa";

describe("finance-fatturapa", () => {
  it("builds xml with invoice number", () => {
    const xml = buildFatturaPaXml({
      entry: {
        id: "e1",
        label: "Retainer",
        invoiceNumber: "ONZ-2026-0001",
        amountEur: { toString: () => "1500" } as never,
        dueDate: new Date("2026-06-01"),
        paidAt: null,
        type: "INCOME",
      },
      clientName: "Demo Srl",
      clientVat: "IT12345678901",
      issuerName: "Test Issuer",
      issuerVat: "IT00000000000",
    });
    expect(xml).toContain("FatturaElettronica");
    expect(xml).toContain("ONZ-2026-0001");
    expect(xml).toContain("1500.00");
  });
});
