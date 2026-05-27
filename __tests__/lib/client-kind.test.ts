import { inferClientKind, normalizeVatNumber } from "@/lib/client-kind";
import { extractVatFromProspectCommand, isProspectVatCommand } from "@/lib/prospect-vat-pipeline";

describe("client-kind", () => {
  it("inferisce BUSINESS da P.IVA", () => {
    expect(inferClientKind({ vatNumber: "12345678901" })).toBe("BUSINESS");
  });

  it("inferisce PRIVATE da CF", () => {
    expect(inferClientKind({ fiscalCode: "RSSMRA80A01H501U" })).toBe("PRIVATE");
  });
});

describe("prospect-vat-pipeline", () => {
  it("estrae P.IVA da comando naturale", () => {
    const cmd =
      "Onizuka, inserisci come prospect per servizi digitali/AI questa partita IVA 12345678901";
    expect(extractVatFromProspectCommand(cmd)).toBe("12345678901");
    expect(isProspectVatCommand(cmd)).toBe(true);
  });

  it("normalizza P.IVA", () => {
    expect(normalizeVatNumber(" IT 12345678901 ")).toBe("IT12345678901");
  });
});
