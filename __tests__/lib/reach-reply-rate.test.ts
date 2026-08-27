import {
  comuneDi,
  contattiDagliInvii,
  segmentoDi,
  tassiPerChiave,
  type EsitoInvio,
} from "@/lib/reach-reply-rate";

function invio(p: Partial<EsitoInvio> & { id: string }): EsitoInvio {
  return {
    abVariantSent: null,
    repliedAt: null,
    sentToEmail: null,
    client: null,
    lead: null,
    ...p,
  };
}

describe("tasso di risposta", () => {
  it("conta le PERSONE contattate, non le bozze", () => {
    // Tre mail della stessa sequenza allo stesso recapito = un contatto solo.
    const contatti = contattiDagliInvii([
      invio({ id: "3", sentToEmail: "info@bar.it" }),
      invio({ id: "2", sentToEmail: "info@bar.it" }),
      invio({ id: "1", sentToEmail: "info@bar.it", abVariantSent: "A" }),
    ]);
    expect(contatti).toHaveLength(1);
    expect(contatti[0].variante).toBe("Variante A");
  });

  it("dà il merito alla prima mail anche se la risposta arriva al follow-up", () => {
    // Gli invii arrivano dal più recente al più vecchio, come li ordina la query.
    const contatti = contattiDagliInvii([
      invio({ id: "2", sentToEmail: "info@bar.it", abVariantSent: "B", repliedAt: new Date() }),
      invio({ id: "1", sentToEmail: "info@bar.it", abVariantSent: "A" }),
    ]);
    expect(contatti[0].variante).toBe("Variante A");
    expect(contatti[0].risposta).toBe(true);
  });

  it("tiene separati recapiti diversi e calcola il tasso per gruppo", () => {
    const contatti = contattiDagliInvii([
      invio({ id: "1", sentToEmail: "a@x.it", abVariantSent: "A", repliedAt: new Date() }),
      invio({ id: "2", sentToEmail: "b@x.it", abVariantSent: "A" }),
      invio({ id: "3", sentToEmail: "c@x.it", abVariantSent: "B" }),
    ]);
    const perVariante = tassiPerChiave(contatti, (c) => c.variante);
    const a = perVariante.find((r) => r.chiave === "Variante A");
    expect(a).toEqual({ chiave: "Variante A", contattati: 2, risposte: 1, tasso: 50 });
    expect(perVariante.find((r) => r.chiave === "Variante B")?.tasso).toBe(0);
  });

  it("senza recapito registrato non fonde bozze diverse", () => {
    const contatti = contattiDagliInvii([invio({ id: "1" }), invio({ id: "2" })]);
    expect(contatti).toHaveLength(2);
  });

  it("segmenta per sito reale, non per presenza di un URL qualsiasi", () => {
    expect(segmentoDi(invio({ id: "1", lead: { website: null, city: null, source: null } }))).toMatch(/senza sito/);
    expect(
      segmentoDi(invio({ id: "2", lead: { website: "https://facebook.com/bar", city: null, source: null } }))
    ).toMatch(/senza sito/);
    expect(
      segmentoDi(invio({ id: "3", lead: { website: "https://barroma.it", city: null, source: null } }))
    ).toMatch(/con sito/);
  });

  it("prende il comune dall'origine dello scraping, poi dalla città", () => {
    expect(
      comuneDi(invio({ id: "1", lead: { website: null, city: "BIBBONA", source: "scraping:Bibbona" } }))
    ).toBe("Bibbona");
    expect(
      comuneDi(invio({ id: "2", lead: { website: null, city: "CECINA", source: "vat_form" } }))
    ).toBe("Cecina");
    expect(comuneDi(invio({ id: "3" }))).toBe("—");
  });
});
