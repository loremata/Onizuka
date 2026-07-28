import { featureReadiness, allFeatureReadiness } from "@/lib/feature-readiness";

/**
 * L'onestà dell'interfaccia non è un dettaglio estetico: se una funzione non è
 * collegata, la pagina deve dirlo. Questi test difendono il contratto del
 * banner, non i valori delle chiavi.
 */
describe("prontezza delle funzioni", () => {
  const ENV = process.env;
  beforeEach(() => {
    process.env = { ...ENV };
    delete process.env.OPENAI_API_KEY;
    delete process.env.META_PAGE_ACCESS_TOKEN;
    delete process.env.META_PAGE_ID;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_AUTHOR_URN;
    delete process.env.GOOGLE_GBP_ACCESS_TOKEN;
    delete process.env.GOOGLE_GBP_LOCATION_NAME;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.GOOGLE_ANALYTICS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    delete process.env.META_ADS_ACCESS_TOKEN;
    jest.resetModules();
  });
  afterAll(() => {
    process.env = ENV;
  });

  it("senza chiavi, nulla si dichiara pronto", () => {
    for (const f of allFeatureReadiness()) {
      expect(f.ready).toBe(false);
    }
  });

  it("ogni funzione dice cosa NON succede e cosa funziona lo stesso", () => {
    for (const f of allFeatureReadiness()) {
      expect(f.doesNotHappen.length).toBeGreaterThan(10);
      expect(f.worksAnyway.length).toBeGreaterThan(10);
      expect(f.missing.length).toBeGreaterThan(5);
      expect(f.label.length).toBeGreaterThan(3);
    }
  });

  it("l'assistente si accende con la chiave del modello", () => {
    expect(featureReadiness("assistant-llm").ready).toBe(false);
    process.env.OPENAI_API_KEY = "sk-test";
    expect(featureReadiness("assistant-llm").ready).toBe(true);
  });

  it("basta UN canale social per considerare attiva la pubblicazione", () => {
    expect(featureReadiness("social-publishing").ready).toBe(false);
    process.env.LINKEDIN_ACCESS_TOKEN = "t";
    process.env.LINKEDIN_AUTHOR_URN = "urn:li:person:1";
    expect(featureReadiness("social-publishing").ready).toBe(true);
  });

  it("WhatsApp richiede token E numero, non uno solo", () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "t";
    expect(featureReadiness("whatsapp").ready).toBe(false);
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
    expect(featureReadiness("whatsapp").ready).toBe(true);
  });

  it("le chiavi sono tutte distinte: nessuna funzione si sovrascrive", () => {
    const keys = allFeatureReadiness().map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
