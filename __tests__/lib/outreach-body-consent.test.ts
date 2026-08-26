import { appendOutreachTextFooter, wrapOutreachHtmlBody } from "@/lib/outreach-tracking";

/**
 * Regressione GDPR: ogni email commerciale deve portare il link di disiscrizione,
 * e pixel/riscrittura link non devono comparire senza consenso esplicito.
 */
describe("corpo email outreach", () => {
  const UNSUB = "https://onizuka.it/api/public/unsubscribe/tok123";
  const BODY = "Ciao, ti scrivo per il sito https://esempio.it — dimmi tu.";

  describe("senza consenso esplicito (contatto a freddo)", () => {
    const html = wrapOutreachHtmlBody(BODY, "draft1", {
      unsubscribeUrl: UNSUB,
      tracking: false,
      sourceNote: "Contatto da fonti pubbliche.",
    });

    it("non inserisce il pixel di apertura", () => {
      expect(html).not.toContain("/api/reach/track/open/");
      expect(html).not.toContain("<img");
    });

    it("non riscrive i link verso il redirect di tracciamento", () => {
      expect(html).not.toContain("/api/reach/track/click/");
    });

    it("porta comunque il link di disiscrizione", () => {
      expect(html).toContain(UNSUB);
      expect(html).toContain("Per non ricevere più queste email");
    });

    it("dichiara da dove arriva il contatto", () => {
      expect(html).toContain("Contatto da fonti pubbliche.");
    });
  });

  describe("con consenso esplicito", () => {
    const html = wrapOutreachHtmlBody(BODY, "draft1", { unsubscribeUrl: UNSUB, tracking: true });

    it("inserisce pixel e link tracciati", () => {
      expect(html).toContain("/api/reach/track/open/");
      expect(html).toContain("/api/reach/track/click/");
    });

    it("porta comunque il link di disiscrizione", () => {
      expect(html).toContain(UNSUB);
    });
  });

  it("non aggiunge un footer vuoto quando non c'è nulla da dire", () => {
    const html = wrapOutreachHtmlBody(BODY, "draft1", {});
    expect(html).not.toContain("<hr");
    expect(appendOutreachTextFooter(BODY, {})).toBe(BODY);
  });

  it("mette la disiscrizione anche nella versione testuale", () => {
    const text = appendOutreachTextFooter(BODY, { unsubscribeUrl: UNSUB });
    expect(text).toContain(BODY);
    expect(text).toContain(UNSUB);
  });

  it("scherma l'HTML del corpo", () => {
    const html = wrapOutreachHtmlBody("<script>alert(1)</script>", "draft1", {});
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
