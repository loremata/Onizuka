import { parseEurAmount } from "@/lib/parse-eur";

/**
 * Regressione: `raw.replace(",", ".")` sostituiva solo la PRIMA virgola, quindi
 * "1.500,00" diventava "1.500.00" → NaN → valore azzerato in silenzio.
 */
describe("parseEurAmount", () => {
  const eur = (raw: string | null) => parseEurAmount(raw)?.toString() ?? null;

  it("legge il formato italiano con migliaia e decimali", () => {
    expect(eur("1.500,00")).toBe("1500");
    expect(eur("1.500,50")).toBe("1500.5");
    expect(eur("12.345.678,90")).toBe("12345678.9");
  });

  it("legge il formato italiano senza decimali", () => {
    expect(eur("1.500")).toBe("1500");
    expect(eur("12.000")).toBe("12000");
  });

  it("legge la sola virgola decimale", () => {
    expect(eur("1500,50")).toBe("1500.5");
    expect(eur("0,99")).toBe("0.99");
  });

  it("continua a leggere il formato inglese", () => {
    expect(eur("1500.50")).toBe("1500.5");
    expect(eur("1,500.00")).toBe("1500");
    expect(eur("1500")).toBe("1500");
  });

  it("tollera spazi e simbolo di valuta", () => {
    expect(eur(" € 1.500,00 ")).toBe("1500");
  });

  it("con la sola virgola la tratta sempre come decimale", () => {
    // In una interfaccia italiana "1,500" vale 1,50 €: chi intende millecinquecento
    // scrive "1500" o "1.500". Arrotondamento a due decimali.
    expect(eur("1,500")).toBe("1.5");
    expect(eur("10,999")).toBe("11");
  });

  it("rifiuta valori non numerici e negativi", () => {
    expect(eur("abc")).toBeNull();
    expect(eur("-100")).toBeNull();
    expect(eur("1.2.3,4,5")).toBeNull();
  });

  it("tratta il vuoto come assenza di valore", () => {
    expect(eur(null)).toBeNull();
    expect(eur("")).toBeNull();
    expect(eur("   ")).toBeNull();
  });
});
