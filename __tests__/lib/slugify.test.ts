import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("normalizza spazi e caratteri speciali", () => {
    expect(slugify("  Demo Client & Co!  ")).toBe("demo-client-co");
  });

  it("rimuove segmenti non alfanumerici lasciando trattini coerenti", () => {
    expect(slugify("A---B")).toBe("a-b");
  });

  it("restituisce stringa vuota se non restano caratteri utili", () => {
    expect(slugify("@@@")).toBe("");
  });
});
