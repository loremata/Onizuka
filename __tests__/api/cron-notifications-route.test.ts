/** @jest-environment node */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/notifications/route";

jest.mock("@/lib/finance-overdue", () => ({
  syncFinanceOverdueStatuses: jest.fn(() => Promise.resolve(0)),
}));

jest.mock("@/lib/automation-rules-run", () => ({
  runFinanceOverdueSnapshotAutomationRules: jest.fn(() => Promise.resolve({ ownersNotified: 0 })),
}));

jest.mock("@/lib/flow-due-notifications", () => ({
  runFlowDueReminders: jest.fn(() => Promise.resolve({ dueToday: 1, overdue: 0, skipped: 0 })),
}));

jest.mock("@/lib/notification-digest", () => ({
  sendDigestToUsersWithUnread: jest.fn(() => Promise.resolve({ attempted: 0, sent: 0, errors: 0 })),
}));

jest.mock("@/lib/ticket-sla-cron", () => ({
  runTicketSlaBreachCheck: jest.fn(() => Promise.resolve({ breached: 0, notified: 0 })),
}));

jest.mock("@/lib/ops-weekly-digest", () => ({
  shouldSendOpsWeeklyDigestToday: jest.fn(() => false),
  sendOpsWeeklyDigestToAllAdmins: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: jest.fn(() => Promise.resolve([])),
    },
  },
}));

describe("GET /api/cron/notifications", () => {
  const prevSecret = process.env.CRON_SECRET;
  const prevCronFlags = {
    LEAD_FOLLOWUP_CRON: process.env.LEAD_FOLLOWUP_CRON,
    INTELLIGENCE_REFRESH_CRON: process.env.INTELLIGENCE_REFRESH_CRON,
    OPPORTUNITY_SLA_CRON: process.env.OPPORTUNITY_SLA_CRON,
    MEETING_FOLLOWTHROUGH_CRON: process.env.MEETING_FOLLOWTHROUGH_CRON,
    DEDUPE_SCAN_CRON: process.env.DEDUPE_SCAN_CRON,
    FINANCE_RENEWAL_CRON: process.env.FINANCE_RENEWAL_CRON,
    AUTOMATION_QUEUE_CRON: process.env.AUTOMATION_QUEUE_CRON,
    NOTIFY_DIGEST_CRON: process.env.NOTIFY_DIGEST_CRON,
    QUOTE_NO_RESPONSE_CRON: process.env.QUOTE_NO_RESPONSE_CRON,
  };

  beforeEach(() => {
    process.env.LEAD_FOLLOWUP_CRON = "0";
    process.env.INTELLIGENCE_REFRESH_CRON = "0";
    process.env.OPPORTUNITY_SLA_CRON = "0";
    process.env.MEETING_FOLLOWTHROUGH_CRON = "0";
    process.env.DEDUPE_SCAN_CRON = "0";
    process.env.FINANCE_RENEWAL_CRON = "0";
    process.env.AUTOMATION_QUEUE_CRON = "0";
    process.env.NOTIFY_DIGEST_CRON = "0";
    process.env.QUOTE_NO_RESPONSE_CRON = "0";
  });

  afterEach(() => {
    process.env.CRON_SECRET = prevSecret;
    for (const [k, v] of Object.entries(prevCronFlags)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("returns 401 without secret", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const req = new NextRequest("http://localhost/api/cron/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with bearer token", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const req = new NextRequest("http://localhost/api/cron/notifications", {
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.flow.dueToday).toBe(1);
    expect(body.financeAutomation).toEqual({ ownersNotified: 0 });
  });
});
