import { buildQuoteEmailText, quoteEmailEnabled } from "@/lib/quote-email";

describe("quote-email", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.QUOTE_NOTIFY_EMAIL;
    delete process.env.GMAIL_SMTP_HOST;
    delete process.env.GMAIL_SMTP_USER;
    delete process.env.GMAIL_SMTP_PASSWORD;
  });

  afterAll(() => {
    process.env = env;
  });

  it("buildQuoteEmailText includes totals and view url", () => {
    const text = buildQuoteEmailText({
      title: "Pacchetto social",
      clientName: "Demo Srl",
      linesJson: JSON.stringify([{ description: "Gestione", quantity: 1, unitPrice: 500 }]),
      taxPercent: 22,
      notes: "Valido 30 giorni",
      viewUrl: "https://app.example/quotes/abc",
      hasPdfAttachment: true,
    });
    expect(text).toContain("Demo Srl");
    expect(text).toContain("Pacchetto social");
    expect(text).toContain("In allegato il PDF");
    expect(text).toContain("Totale:");
    expect(text).toContain("https://app.example/quotes/abc");
    expect(text).toContain("Valido 30 giorni");
  });

  it("quoteEmailEnabled is false without SMTP", () => {
    expect(quoteEmailEnabled()).toBe(false);
  });

  it("quoteEmailEnabled respects QUOTE_NOTIFY_EMAIL=0", () => {
    process.env.GMAIL_SMTP_HOST = "smtp.test";
    process.env.GMAIL_SMTP_USER = "u";
    process.env.GMAIL_SMTP_PASSWORD = "p";
    process.env.QUOTE_NOTIFY_EMAIL = "0";
    expect(quoteEmailEnabled()).toBe(false);
  });

  it("quoteEmailEnabled is true when SMTP configured", () => {
    process.env.GMAIL_SMTP_HOST = "smtp.test";
    process.env.GMAIL_SMTP_USER = "u";
    process.env.GMAIL_SMTP_PASSWORD = "p";
    expect(quoteEmailEnabled()).toBe(true);
  });
});
