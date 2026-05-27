import { buildNotificationDigestText, digestEmailEnabled } from "@/lib/notification-digest";

describe("notification-digest", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.NOTIFY_DIGEST_EMAIL;
    delete process.env.GMAIL_SMTP_HOST;
  });

  afterAll(() => {
    process.env = env;
  });

  it("builds digest text with links", () => {
    const text = buildNotificationDigestText(
      [
        {
          title: "Nuovo ticket",
          body: "Dettaglio",
          href: "/app/tickets",
          createdAt: new Date("2026-05-23T12:00:00Z"),
        },
      ],
      "https://app.example"
    );
    expect(text).toContain("1 notifica");
    expect(text).toContain("Nuovo ticket");
    expect(text).toContain("https://app.example/app/tickets");
  });

  it("digestEmailEnabled respects env", () => {
    process.env.GMAIL_SMTP_HOST = "smtp.test";
    process.env.GMAIL_SMTP_USER = "u";
    process.env.GMAIL_SMTP_PASSWORD = "p";
    expect(digestEmailEnabled()).toBe(true);
    process.env.NOTIFY_DIGEST_EMAIL = "0";
    expect(digestEmailEnabled()).toBe(false);
  });
});
