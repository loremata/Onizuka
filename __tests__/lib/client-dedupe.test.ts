import { normalizeCompanyDedupeKey, normalizeEmail, normalizeVat, levenshtein } from "@/lib/client-dedupe";

describe("client-dedupe normalize", () => {
  it("normalizza P.IVA", () => {
    expect(normalizeVat(" it 12345678901 ")).toBe("IT12345678901");
    expect(normalizeVat("123")).toBeNull();
  });

  it("normalizza email", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(normalizeEmail("invalid")).toBeNull();
  });

  it("normalizza ragione sociale per dedupe nome", () => {
    expect(normalizeCompanyDedupeKey("  Pasticceria  Bianchi   SRL  ")).toBe("pasticceria bianchi");
    expect(normalizeCompanyDedupeKey("AB")).toBeNull();
  });

  it("Levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("foo", "foo")).toBe(0);
    expect(levenshtein("abc", "abx")).toBe(1);
  });
});
