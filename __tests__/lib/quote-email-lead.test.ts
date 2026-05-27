import { sendQuoteEmail } from "@/lib/quote-email";

jest.mock("@/lib/smtp-send", () => ({
  isSmtpConfigured: jest.fn(() => true),
  sendEmailViaSmtp: jest.fn(async () => ({ ok: true as const })),
}));

jest.mock("@/lib/quote-pdf-load", () => ({
  loadQuotePdfForOwner: jest.fn(async () => ({ ok: false as const })),
}));

jest.mock("@/lib/admin-audit-log", () => ({ logAdminAction: jest.fn() }));
jest.mock("@/lib/user-notifications", () => ({ notifyClientUsers: jest.fn() }));
jest.mock("@/lib/quote-no-response", () => ({
  scheduleQuoteNoResponseReminder: jest.fn(async () => undefined),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    opportunityQuote: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("@/lib/prisma");
const { sendEmailViaSmtp } = jest.requireMock("@/lib/smtp-send");

describe("sendQuoteEmail lead-only opportunity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.QUOTE_NOTIFY_EMAIL = "1";
  });

  it("sends to lead email when client is absent", async () => {
    prisma.opportunityQuote.findFirst.mockResolvedValue({
      id: "q1",
      ownerUserId: "u1",
      opportunityId: "opp1",
      title: "Preventivo test",
      linesJson: "[]",
      taxPercent: 22,
      status: "DRAFT",
      sentAt: null,
      notes: null,
      opportunity: {
        client: null,
        lead: { id: "l1", businessName: "Lead Biz", title: "Lead", email: "lead@test.example" },
      },
    });
    prisma.opportunityQuote.update.mockResolvedValue({});

    const res = await sendQuoteEmail("q1", "u1");
    expect(res).toEqual({ ok: true });
    expect(sendEmailViaSmtp).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lead@test.example" })
    );
  });

  it("blocks send when lead has no email", async () => {
    prisma.opportunityQuote.findFirst.mockResolvedValue({
      id: "q2",
      ownerUserId: "u1",
      opportunityId: "opp2",
      title: "Preventivo",
      linesJson: "[]",
      taxPercent: 22,
      status: "DRAFT",
      sentAt: null,
      notes: null,
      opportunity: {
        client: null,
        lead: { id: "l1", businessName: "Lead", title: "L", email: null },
      },
    });

    const res = await sendQuoteEmail("q2", "u1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/lead/i);
  });
});
