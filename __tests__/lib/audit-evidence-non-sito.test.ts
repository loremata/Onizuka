import { isNonSito, piattaformaDi } from "@/lib/audit-evidence";

describe("isNonSito", () => {
  it("riconosce i profili su piattaforme altrui", () => {
    expect(isNonSito("https://www.facebook.com/pizzeriaroma")).toBe(true);
    expect(isNonSito("https://x.com/azienda")).toBe(true);
    expect(isNonSito("https://twitter.com/azienda")).toBe(true);
    expect(isNonSito("https://miobar.wixsite.com/home")).toBe(true);
    expect(isNonSito("https://negozio.business.site")).toBe(true);
    expect(isNonSito("https://www.tripadvisor.it/Restaurant_Review-x")).toBe(true);
    expect(isNonSito("https://it.tripadvisor.com/Hotel")).toBe(true);
    expect(isNonSito("https://vecchiaosteria.blogspot.com")).toBe(true);
  });

  it("non boccia i siti veri che contengono quelle lettere", () => {
    // Il bug: "x.com" cercato dentro la stringa dell'URL. A queste aziende si
    // finiva per scrivere che un sito non ce l'hanno.
    expect(isNonSito("https://www.linux.com")).toBe(false);
    expect(isNonSito("https://phoenix.com")).toBe(false);
    expect(isNonSito("https://www.ottica-felix.com")).toBe(false);
    expect(isNonSito("https://www.europages-service.it")).toBe(false);
    expect(isNonSito("https://ristorantefacebook-non-esiste.it")).toBe(false);
    expect(isNonSito("https://www.pizzeriaroma.it")).toBe(false);
  });

  it("tollera url scritti senza protocollo", () => {
    expect(isNonSito("facebook.com/azienda")).toBe(true);
    expect(isNonSito("www.pizzeriaroma.it")).toBe(false);
  });

  it("dà un'etichetta leggibile della piattaforma", () => {
    expect(piattaformaDi("https://www.facebook.com/pizzeriaroma")).toContain("Facebook");
    expect(piattaformaDi("https://www.pizzeriaroma.it")).toBeNull();
  });
});
