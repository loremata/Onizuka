import { extractRichSignals, pickBusinessPhone } from "@/lib/website-probe";

describe("estrazione contatti dal sito", () => {
  describe("pickBusinessPhone", () => {
    it("i tel: vincono sui numeri trovati nel testo", () => {
      expect(pickBusinessPhone(["+39 0586 123456"], ["333 1234567"])).toBe("+39 0586 123456");
    });

    it("accetta fissi e mobili italiani, con e senza prefisso internazionale", () => {
      expect(pickBusinessPhone(["0586 123456"])).toBe("0586 123456");
      expect(pickBusinessPhone([], ["3331234567"])).toBe("3331234567");
      expect(pickBusinessPhone(["0039 333 1234567"])).toBe("0039 333 1234567");
    });

    it("scarta sequenze troppo corte, troppo lunghe o banali", () => {
      expect(pickBusinessPhone(["12345"])).toBeUndefined();
      expect(pickBusinessPhone(["333333333333333"])).toBeUndefined();
      expect(pickBusinessPhone(["0000000000"])).toBeUndefined();
      expect(pickBusinessPhone([], ["1234567890"])).toBeUndefined(); // non inizia per 0/3
    });

    it("dal testo scarta le 11 cifre che iniziano per 0 (P.IVA), da tel: no", () => {
      expect(pickBusinessPhone([], ["01234567890"])).toBeUndefined();
      expect(pickBusinessPhone(["01234567890"])).toBe("01234567890");
    });

    it("un mobile non supera le 10 cifre, da nessuna fonte", () => {
      expect(pickBusinessPhone(["35712201549"])).toBeUndefined();
      expect(pickBusinessPhone([], ["35712201549"])).toBeUndefined();
    });

    it("salta i candidati invalidi e prende il primo buono", () => {
      expect(pickBusinessPhone(["12345", "0586 654321"])).toBe("0586 654321");
    });
  });

  describe("extractRichSignals — telefono", () => {
    it("estrae il numero dal link tel:", () => {
      const html = `<html><body><a href="tel:+390586123456">Chiamaci</a></body></html>`;
      const s = extractRichSignals(html, html.toLowerCase());
      expect(s.hasTelLink).toBe(true);
      expect(s.phone).toBe("+390586123456");
    });

    it("ripiega sul numero nel testo se non c'è tel:", () => {
      const html = `<html><body><p>Chiama lo 0586 123456 per un preventivo</p></body></html>`;
      const s = extractRichSignals(html, html.toLowerCase());
      expect(s.hasTelLink).toBe(false);
      expect(s.phone).toContain("0586");
    });

    it("il tel: vince sul numero nel testo", () => {
      const html = `<html><body><p>Numero vecchio 0586 999999</p><a href="tel:3331234567">mobile</a></body></html>`;
      const s = extractRichSignals(html, html.toLowerCase());
      expect(s.phone).toBe("3331234567");
    });

    it("nessun numero → phone undefined", () => {
      const html = `<html><body><p>Solo testo, P.IVA 01234567890 non è un telefono</p></body></html>`;
      const s = extractRichSignals(html, html.toLowerCase());
      // La P.IVA (11 cifre, inizia per 0) trovata nel TESTO viene scartata.
      expect(s.phone).toBeUndefined();
    });

    it("non estrae sottostringhe da sequenze più lunghe (P.IVA che non inizia per 0)", () => {
      // Senza confine sinistro il motore ripartiva dal 2° carattere:
      // "13571220154" produceva il finto mobile "3571220154".
      const html = `<html><body><p>P.IVA 13571220154 — codice ordine 88330612345</p></body></html>`;
      const s = extractRichSignals(html, html.toLowerCase());
      expect(s.phone).toBeUndefined();
    });

    it("continua a estrarre l'email aziendale", () => {
      const html = `<html><body><a href="mailto:info@officina.it">scrivici</a></body></html>`;
      const s = extractRichSignals(html, html.toLowerCase(), "officina.it");
      expect(s.email).toBe("info@officina.it");
    });
  });
});
