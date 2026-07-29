import { missingRequiredSaleData } from "@/lib/inserimenti/sale-required-data";

const base = {
  lineKey: "MOBILE",
  lineUnit: "EUR_PER_PIECE",
  subtype: null,
  offerCode: null,
  feeEur: null,
  provenance: null,
  offerPricesForLine: [] as number[],
};

describe("dati obbligatori della vendita", () => {
  it("pista a moltiplicatore senza canone: si rifiuta", () => {
    const m = missingRequiredSaleData({ ...base, lineKey: "ACCESSO_FISSO", lineUnit: "MULTIPLIER_ON_FEE" });
    expect(m?.field).toBe("feeEur");
    expect(m?.affectsMoney).toBe(true);
  });

  it("FWA ricaricabile senza canone: è corretto così, a gettone il canone non esiste", () => {
    expect(
      missingRequiredSaleData({
        ...base,
        lineKey: "ACCESSO_FISSO",
        lineUnit: "MULTIPLIER_ON_FEE",
        subtype: "FWA_RIC",
      })
    ).toBeNull();
  });

  it("gettone con offerte a prezzi diversi senza offerta: si rifiuta, e dice l'intervallo", () => {
    const m = missingRequiredSaleData({ ...base, offerPricesForLine: [145, 180, 240] });
    expect(m?.field).toBe("offerCode");
    expect(m?.message).toContain("145");
    expect(m?.message).toContain("240");
  });

  it("una sola offerta possibile: nessuna ambiguità, si passa", () => {
    expect(missingRequiredSaleData({ ...base, offerPricesForLine: [112] })).toBeNull();
    expect(missingRequiredSaleData({ ...base, offerPricesForLine: [112, 112] })).toBeNull();
  });

  it("nessuna offerta a listino: non si può pretendere di sceglierne una", () => {
    expect(missingRequiredSaleData({ ...base, offerPricesForLine: [] })).toBeNull();
  });

  it("MNP senza provenienza: si chiede, ma non è un problema di soldi", () => {
    const m = missingRequiredSaleData({ ...base, lineKey: "MNP", offerPricesForLine: [] });
    expect(m?.field).toBe("provenance");
    expect(m?.affectsMoney).toBe(false);
  });

  it("MNP completa: nessun rilievo", () => {
    expect(
      missingRequiredSaleData({ ...base, lineKey: "MNP", provenance: "ILIAD" })
    ).toBeNull();
  });

  it("il canone viene prima dell'offerta: si chiede il difetto più grave", () => {
    const m = missingRequiredSaleData({
      ...base,
      lineUnit: "MULTIPLIER_ON_FEE",
      offerPricesForLine: [145, 240],
    });
    expect(m?.field).toBe("feeEur");
  });

  it("riga completa: si passa", () => {
    expect(
      missingRequiredSaleData({ ...base, offerCode: "FW-CASA-PRO", offerPricesForLine: [145, 240] })
    ).toBeNull();
  });
});
