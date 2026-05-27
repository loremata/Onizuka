import { buildQuotePdfBuffer, quotePdfFilename } from "@/lib/quote-pdf";

describe("quote-pdf", () => {
  it("quotePdfFilename sanitizes title", () => {
    expect(quotePdfFilename("Pacchetto Social 2026!", "clxxxxxxxx")).toMatch(/^preventivo-pacchetto-social/);
    expect(quotePdfFilename("Pacchetto Social 2026!", "clxxxxxxxx")).toMatch(/\.pdf$/);
  });

  it("buildQuotePdfBuffer returns a PDF buffer", async () => {
    const buffer = await buildQuotePdfBuffer({
      quoteId: "quote123",
      title: "Test preventivo",
      clientName: "Demo Srl",
      vatNumber: "IT123",
      opportunityTitle: "Opp demo",
      statusLabel: "Bozza",
      linesJson: JSON.stringify([{ description: "Servizio", quantity: 1, unitPrice: 100 }]),
      taxPercent: 22,
      notes: null,
      validUntil: null,
    });
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
