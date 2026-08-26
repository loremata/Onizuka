import { buildReplyKit } from "@/lib/reply-kit";

describe("kit di risposta", () => {
  it("tre scenari, personalizzati e col link fresco al report", () => {
    const kit = buildReplyKit({ company: "Meini Immobiliare", reportUrl: "https://onizuka.it/report/AbC123def456ghi789JkL" });
    expect(kit).toContain("SE È INTERESSATO");
    expect(kit).toContain("SE CHIEDE IL PREZZO");
    expect(kit).toContain("SE CHIEDE CHI SIAMO");
    expect(kit).toContain("Meini Immobiliare");
    expect(kit).toContain("https://onizuka.it/report/AbC123def456ghi789JkL");
    // Regola del 26/08: mai cifre per iscritto.
    expect(kit).not.toMatch(/\d+\s*€/);
    // La credenziale è il negozio fisico.
    expect(kit).toContain("Via Vecchia Aurelia 393");
  });

  it("senza azienda e senza report resta presentabile", () => {
    const kit = buildReplyKit({});
    expect(kit).toContain("la vostra attività");
    expect(kit).not.toContain("null");
    expect(kit).not.toContain("undefined");
    expect(kit).not.toMatch(/https?:\/\//);
  });
});
