import { validateOutreachDraft, describeOutreachQuality } from "@/lib/outreach-quality";

/**
 * I casi qui sotto sono difetti realmente arrivati in coda di invio: servono a
 * impedire che si ripresentino silenziosamente.
 */

const CORPO_BUONO = [
  "Buongiorno,",
  "ho dato un'occhiata alla presenza online della vostra attività e ho notato due cose concrete:",
  "- la scheda Google non ha gli orari di apertura pubblicati;",
  "- 3 immagini su 4 del sito non hanno una descrizione testuale.",
  "Ho preparato un riepilogo qui: https://onizuka.it/report/AbCdEf0123456789XyZw",
  "Se le interessa ne parliamo in cinque minuti.",
  "Lorenzo — Online Station",
].join("\n");

describe("qualità della bozza outreach", () => {
  it("promuove una bozza scritta bene", () => {
    const r = validateOutreachDraft({
      subject: "Due cose sistemabili sulla vostra presenza online",
      body: CORPO_BUONO,
    });
    expect(r.ok).toBe(true);
    expect(r.problems).toHaveLength(0);
    expect(describeOutreachQuality(r)).toBe("Testo verificato.");
  });

  it("blocca i segnaposto mai sostituiti", () => {
    const r = validateOutreachDraft({
      subject: "Proposta",
      body: CORPO_BUONO.replace("Buongiorno,", "Buongiorno, sono [nome] di Online Station."),
    });
    expect(r.ok).toBe(false);
    expect(r.problems.map((p) => p.code)).toContain("placeholder_residuo");
  });

  it("blocca i segnaposto a graffe dei template", () => {
    const r = validateOutreachDraft({
      subject: "Proposta per {{companyName}}",
      body: CORPO_BUONO,
    });
    expect(r.problems.map((p) => p.code)).toContain("placeholder_residuo");
  });

  it("blocca le interpolazioni fallite", () => {
    const r = validateOutreachDraft({
      subject: "Proposta",
      body: `${CORPO_BUONO}\nPunteggio rilevato: undefined`,
    });
    expect(r.problems.map((p) => p.code)).toContain("valore_mancante");
  });

  it("blocca il punteggio 0/100, che di norma significa 'non misurato'", () => {
    const r = validateOutreachDraft({
      subject: "Analisi",
      body: `${CORPO_BUONO}\nPunteggio sintetico 0/100.`,
    });
    expect(r.problems.map((p) => p.code)).toContain("punteggio_zero");
  });

  it("blocca la ragione sociale grezza da visura", () => {
    const r = validateOutreachDraft({
      subject: "Proposta per Rossi E Bianchi S.R.L.",
      body: CORPO_BUONO,
    });
    expect(r.problems.map((p) => p.code)).toContain("ragione_sociale_grezza");
  });

  it("riconosce anche 'Societa'' con apostrofo dalla visura", () => {
    const r = validateOutreachDraft({
      subject: "Proposta",
      body: `${CORPO_BUONO}\nAz. Agr. Marchi Societa' Semplice`,
    });
    expect(r.problems.map((p) => p.code)).toContain("ragione_sociale_grezza");
  });

  it("blocca il nome-segnaposto dell'anagrafica (trovato dal vivo il 25/08)", () => {
    const r = validateOutreachDraft({
      subject: "Prospect P.IVA 01887720496: chi vi cerca non trova un sito",
      body: CORPO_BUONO,
    });
    expect(r.problems.map((p) => p.code)).toContain("nome_segnaposto");
  });

  it("blocca il link al report senza token", () => {
    const r = validateOutreachDraft({
      subject: "Analisi",
      body: CORPO_BUONO.replace("https://onizuka.it/report/AbCdEf0123456789XyZw", "https://onizuka.it/report/"),
    });
    expect(r.problems.map((p) => p.code)).toContain("link_report_tronco");
  });

  it("blocca corpo vuoto e oggetto vuoto", () => {
    const r = validateOutreachDraft({ subject: "", body: "" });
    const codes = r.problems.map((p) => p.code);
    expect(codes).toContain("subject_vuoto");
    expect(codes).toContain("body_vuoto");
  });

  it("blocca un corpo troppo corto per dire qualcosa", () => {
    const r = validateOutreachDraft({ subject: "Ciao", body: "Buongiorno, ci sentiamo." });
    expect(r.problems.map((p) => p.code)).toContain("body_troppo_corto");
  });

  it("blocca una voce di elenco rimasta vuota", () => {
    const r = validateOutreachDraft({
      subject: "Analisi",
      body: `${CORPO_BUONO}\n-\nCordiali saluti`,
    });
    expect(r.problems.map((p) => p.code)).toContain("elenco_vuoto");
  });

  it("elenca tutti i problemi trovati, non solo il primo", () => {
    const r = validateOutreachDraft({ subject: "Per {{azienda}} S.r.l.", body: "corto undefined" });
    expect(r.problems.length).toBeGreaterThan(2);
    expect(describeOutreachQuality(r)).toContain("segnaposto");
  });
});
