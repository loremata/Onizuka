import {
  DEFAULT_MARKETING_POLICY,
  emailDomain,
  parseExcludedDomains,
  resolveAutoConsentBasis,
} from "@/lib/marketing-consent-policy";

describe("politica di classificazione dei contatti pubblici", () => {
  it("non discrimina in base al provider di posta", () => {
    // Una piccola attività che pubblica la propria casella Gmail sulla scheda
    // Google sta pubblicando il proprio recapito commerciale come chiunque altro.
    for (const email of [
      "info@officina.it",
      "mario.rossi@gmail.com",
      "bar.centrale@libero.it",
      "contatti@studio.com",
      "pizzeria@hotmail.it",
    ]) {
      expect(resolveAutoConsentBasis(email)).toBe("LEGITIMATE_INTEREST");
    }
  });

  it("non classifica chi non ha un indirizzo utilizzabile", () => {
    expect(resolveAutoConsentBasis(null)).toBe("NONE");
    expect(resolveAutoConsentBasis("")).toBe("NONE");
    expect(resolveAutoConsentBasis("non-una-email")).toBe("NONE");
    expect(resolveAutoConsentBasis("lead+abc@onizuka.local")).toBe("NONE");
  });

  it("rispetta la lista di esclusione quando è configurata", () => {
    const policy = {
      ...DEFAULT_MARKETING_POLICY,
      marketingExcludedDomains: ["gmail.com", "libero.it"],
    };
    expect(resolveAutoConsentBasis("mario@gmail.com", policy)).toBe("NONE");
    expect(resolveAutoConsentBasis("MARIO@GMAIL.COM", policy)).toBe("NONE");
    expect(resolveAutoConsentBasis("info@officina.it", policy)).toBe("LEGITIMATE_INTEREST");
  });

  it("non assegna nulla se il titolare ha scelto così", () => {
    const policy = { ...DEFAULT_MARKETING_POLICY, marketingAutoBasis: "NONE" as const };
    expect(resolveAutoConsentBasis("info@officina.it", policy)).toBe("NONE");
  });

  it("normalizza la lista domini scritta a mano", () => {
    expect(parseExcludedDomains(" @Gmail.com, libero.it ;\n hotmail.IT ")).toEqual([
      "gmail.com",
      "libero.it",
      "hotmail.it",
    ]);
    expect(parseExcludedDomains("gmail.com, gmail.com")).toEqual(["gmail.com"]);
    expect(parseExcludedDomains("senzapunto")).toEqual([]);
    expect(parseExcludedDomains(null)).toEqual([]);
  });

  it("estrae il dominio in minuscolo", () => {
    expect(emailDomain("Info@Officina.IT")).toBe("officina.it");
    expect(emailDomain("rotto@")).toBeNull();
  });
});
