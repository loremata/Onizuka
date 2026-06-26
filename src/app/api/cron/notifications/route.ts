import { NextRequest, NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api-json-errors";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { runFinanceOverdueSnapshotAutomationRules } from "@/lib/automation-rules-run";
import { syncFinanceOverdueStatuses } from "@/lib/finance-overdue";
import { runFlowDueReminders } from "@/lib/flow-due-notifications";
import { sendDigestToUsersWithUnread } from "@/lib/notification-digest";
import {
  sendOpsWeeklyDigestToAllAdmins,
  shouldSendOpsWeeklyDigestToday,
} from "@/lib/ops-weekly-digest";
import { runNightlyDedupeScansForAdmins } from "@/lib/dedupe-cron";
import { runTicketSlaBreachCheck } from "@/lib/ticket-sla-cron";
import { processAutomationFlowQueue } from "@/lib/automation-flow-queue";
import { loadUpcomingFinanceRenewals } from "@/lib/finance-renewals";
import { runLeadFollowupReminders } from "@/lib/lead-followup-cron";
import { runQuoteNoResponseReminders } from "@/lib/quote-no-response";
import { refreshIntelligenceForAllAdmins } from "@/lib/intelligence-refresh-cron";
import { runOpportunitySlaReminders } from "@/lib/opportunity-sla-cron";
import { runMeetingFollowthroughReminders } from "@/lib/meeting-followthrough-cron";
import { runRetailSwitchTaskGeneration } from "@/lib/retail-switch-task-cron";
import { prisma } from "@/lib/prisma";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return jsonApiError(401, "UNAUTHORIZED", "Non autorizzato.");
  }

  const recapZone = process.env.ONIZUKA_RECAP_TIMEZONE?.trim() || undefined;
  const { start: dayStart, end: dayEnd } = resolveRecapDayBounds({
    userTimeZone: recapZone ?? null,
  });

  const financeOverdueSynced = await syncFinanceOverdueStatuses();
  const financeAutomation = await runFinanceOverdueSnapshotAutomationRules();
  const flow = await runFlowDueReminders(dayStart, dayEnd);

  const sendDigest = process.env.NOTIFY_DIGEST_CRON !== "0";
  let digest = { attempted: 0, sent: 0, errors: 0 };
  if (sendDigest) {
    const users = await prisma.user.findMany({
      where: {
        notifyDigestEmail: true,
        notifications: { some: { readAt: null } },
      },
      select: { id: true },
    });
    digest = await sendDigestToUsersWithUnread(users.map((u) => u.id));
  }

  let opsWeekly: { skipped: boolean; attempted?: number; sent?: number; errors?: number } = {
    skipped: true,
  };
  if (shouldSendOpsWeeklyDigestToday()) {
    const result = await sendOpsWeeklyDigestToAllAdmins();
    opsWeekly = { skipped: false, ...result };
  }

  let dedupeNightly = { started: 0 };
  if (process.env.DEDUPE_SCAN_CRON !== "0") {
    dedupeNightly = await runNightlyDedupeScansForAdmins();
  }

  const renewalReminders: { ownerUserId: string; count: number }[] = [];
  if (process.env.FINANCE_RENEWAL_CRON !== "0") {
    const owners = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, email: true, notifyDigestEmail: true },
      take: 20,
    });
    for (const o of owners) {
      const rows = await loadUpcomingFinanceRenewals(o.id, 14);
      if (rows.length > 0) {
        renewalReminders.push({ ownerUserId: o.id, count: rows.length });
        if (o.notifyDigestEmail && o.email) {
          const { isSmtpConfigured, sendEmailViaSmtp } = await import("@/lib/smtp-send");
          if (isSmtpConfigured()) {
            const lines = rows
              .slice(0, 8)
              .map((r) => `· ${r.label} — rinnovo ${r.renewalDate.toISOString().slice(0, 10)}`);
            void sendEmailViaSmtp({
              to: o.email,
              subject: `[Onizuka] ${rows.length} rinnovi MRR entro 14 giorni`,
              text: ["Rinnovi MRR in scadenza:", "", ...lines, "", "Vedi /admin/insights/forecast"].join("\n"),
            }).catch(() => {});
          }
        }
      }
    }
  }

  let leadFollowup = { due: 0, notified: 0, skipped: 0 };
  if (process.env.LEAD_FOLLOWUP_CRON !== "0") {
    leadFollowup = await runLeadFollowupReminders();
  }

  let quoteNoResponse = { due: 0, notified: 0, skipped: 0 };
  if (process.env.QUOTE_NO_RESPONSE_CRON !== "0") {
    quoteNoResponse = await runQuoteNoResponseReminders();
  }

  let intelligenceRefresh = { owners: 0, created: 0 };
  if (process.env.INTELLIGENCE_REFRESH_CRON !== "0") {
    intelligenceRefresh = await refreshIntelligenceForAllAdmins();
  }

  let opportunitySla = { due: 0, notified: 0, skipped: 0 };
  if (process.env.OPPORTUNITY_SLA_CRON !== "0") {
    opportunitySla = await runOpportunitySlaReminders();
  }

  let meetingFollowthrough = { checked: 0, notified: 0, skipped: 0 };
  if (process.env.MEETING_FOLLOWTHROUGH_CRON !== "0") {
    meetingFollowthrough = await runMeetingFollowthroughReminders();
  }

  let retailSwitch = { owners: 0, created: 0, existing: 0 };
  if (process.env.RETAIL_SWITCH_CRON !== "0") {
    retailSwitch = await runRetailSwitchTaskGeneration();
  }

  const ticketSla = await runTicketSlaBreachCheck();

  let automationQueue = { processed: 0, done: 0, failed: 0 };
  if (process.env.AUTOMATION_QUEUE_CRON !== "0") {
    automationQueue = await processAutomationFlowQueue(25);
  }

  return NextResponse.json({
    ok: true,
    financeOverdueSynced,
    financeAutomation,
    flow,
    digest,
    opsWeekly,
    renewalReminders,
    leadFollowup,
    quoteNoResponse,
    intelligenceRefresh,
    opportunitySla,
    meetingFollowthrough,
    retailSwitch,
    dedupeNightly,
    ticketSla,
    automationQueue,
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
  });
}
