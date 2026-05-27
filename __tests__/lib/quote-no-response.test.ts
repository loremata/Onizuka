import { addBusinessDays } from "@/lib/business-days";
import {
  QUOTE_NO_RESPONSE_BUSINESS_DAYS,
  scheduleQuoteNoResponseReminder,
  runQuoteNoResponseReminders,
} from "@/lib/quote-no-response";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    opportunityQuote: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    flowTask: { findFirst: jest.fn(), create: jest.fn() },
    lead: { findFirst: jest.fn() },
    leadFollowup: { findFirst: jest.fn(), create: jest.fn() },
    userNotification: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@/lib/notification-rev", () => ({
  bumpNotificationRev: jest.fn(),
}));

const { prisma } = jest.requireMock("@/lib/prisma") as {
  prisma: {
    opportunityQuote: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    flowTask: { findFirst: jest.Mock; create: jest.Mock };
    lead: { findFirst: jest.Mock };
    leadFollowup: { findFirst: jest.Mock; create: jest.Mock };
    userNotification: { findFirst: jest.Mock; create: jest.Mock };
  };
};

describe("quote-no-response", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.flowTask.findFirst.mockResolvedValue(null);
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.leadFollowup.findFirst.mockResolvedValue(null);
  });

  it("addBusinessDays skips weekends", () => {
    const fri = new Date("2026-05-15T12:00:00");
    const result = addBusinessDays(fri, 1);
    expect(result.getDay()).toBe(1);
  });

  it("scheduleQuoteNoResponseReminder creates flow task for SENT quote", async () => {
    prisma.opportunityQuote.findUnique.mockResolvedValue({
      id: "q1",
      ownerUserId: "u1",
      status: "SENT",
      title: "Preventivo audit",
      sentAt: null,
      opportunity: {
        id: "opp1",
        title: "Opp",
        clientId: "c1",
        client: { companyName: "Bar Srl" },
      },
    });
    prisma.opportunityQuote.update.mockResolvedValue({});

    await scheduleQuoteNoResponseReminder("q1");

    expect(prisma.opportunityQuote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q1" },
        data: expect.objectContaining({ noResponseDueAt: expect.any(Date) }),
      })
    );
    expect(prisma.flowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: expect.stringContaining("Proposta non risposta"),
          source: "quote_no_response",
        }),
      })
    );
  });

  it("scheduleQuoteNoResponseReminder creates task for lead-only opportunity", async () => {
    prisma.opportunityQuote.findUnique.mockResolvedValue({
      id: "q-lead",
      ownerUserId: "u1",
      status: "SENT",
      title: "Preventivo lead",
      sentAt: new Date(),
      opportunity: {
        id: "opp-lead",
        title: "Opp lead",
        clientId: null,
        leadId: "lead-1",
        client: null,
        lead: { id: "lead-1", businessName: "Lead Only", title: "L" },
      },
    });
    prisma.opportunityQuote.update.mockResolvedValue({});
    prisma.leadFollowup.findFirst.mockResolvedValue(null);
    prisma.leadFollowup.create.mockResolvedValue({});

    await scheduleQuoteNoResponseReminder("q-lead");

    expect(prisma.flowTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          relatedClientId: null,
          title: expect.stringContaining("Lead Only"),
        }),
      })
    );
  });

  it("runQuoteNoResponseReminders notifies once per quote per day", async () => {
    prisma.opportunityQuote.findMany.mockResolvedValue([
      {
        id: "q1",
        ownerUserId: "u1",
        title: "P",
        opportunity: { id: "opp1", title: "O", client: { companyName: "X" } },
      },
    ]);
    prisma.userNotification.findFirst.mockResolvedValue(null);
    prisma.userNotification.create.mockResolvedValue({});

    const result = await runQuoteNoResponseReminders();
    expect(result.notified).toBe(1);
    expect(QUOTE_NO_RESPONSE_BUSINESS_DAYS).toBe(5);
  });
});
