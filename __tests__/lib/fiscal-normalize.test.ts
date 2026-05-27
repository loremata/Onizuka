import {
  fiscalValueNeedsNormalization,
  isBlankFiscalRaw,
  normalizeFiscalIdentity,
} from "@/lib/fiscal-normalize";

describe("fiscal-normalize", () => {
  it("normalizeFiscalIdentity trims and uppercases", () => {
    expect(
      normalizeFiscalIdentity({
        vatNumber: " it 12345678901 ",
        fiscalCode: " rssmra80a01h501u ",
      })
    ).toEqual({
      vatNumber: "IT12345678901",
      fiscalCode: "RSSMRA80A01H501U",
    });
  });

  it("empty strings become null", () => {
    expect(normalizeFiscalIdentity({ vatNumber: "   ", fiscalCode: "" })).toEqual({
      vatNumber: null,
      fiscalCode: null,
    });
  });

  it("isBlankFiscalRaw detects whitespace-only", () => {
    expect(isBlankFiscalRaw("  ")).toBe(true);
    expect(isBlankFiscalRaw(null)).toBe(true);
    expect(isBlankFiscalRaw("IT123")).toBe(false);
  });

  it("fiscalValueNeedsNormalization flags dirty VAT", () => {
    expect(fiscalValueNeedsNormalization("it 12345678901", "vat")).toBe(true);
    expect(fiscalValueNeedsNormalization("IT12345678901", "vat")).toBe(false);
  });
});
