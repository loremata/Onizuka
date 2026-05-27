import { ticketNotifyEnabled } from "@/lib/ticket-notify";

describe("ticketNotifyEnabled", () => {
  const orig = process.env;

  beforeEach(() => {
    process.env = { ...orig };
  });

  afterAll(() => {
    process.env = orig;
  });

  it("disabled when TICKET_NOTIFY_EMAIL=0", () => {
    process.env.TICKET_NOTIFY_EMAIL = "0";
    process.env.GMAIL_SMTP_HOST = "smtp.test";
    process.env.GMAIL_SMTP_USER = "u";
    process.env.GMAIL_SMTP_PASSWORD = "p";
    expect(ticketNotifyEnabled()).toBe(false);
  });
});
