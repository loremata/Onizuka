import { computeQuoteTotals, parseQuoteLinesJson } from "@/lib/quote-lines";

describe("quote-lines", () => {
  it("parses and totals lines", () => {
    const lines = parseQuoteLinesJson(
      JSON.stringify([{ description: "Servizio", quantity: 2, unitPrice: 100 }])
    );
    expect(lines).toHaveLength(1);
    const t = computeQuoteTotals(lines, 22);
    expect(t.subtotal).toBe(200);
    expect(t.total).toBeCloseTo(244, 0);
  });
});
