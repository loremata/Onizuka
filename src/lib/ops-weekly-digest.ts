import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";
import { loadInsightsStats } from "@/lib/insights-stats";
import { buildInsightRecommendations } from "@/lib/insights-recommendations";
import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";
import { buildFinanceReconciliationRecommendations } from "@/lib/finance-reconciliation-insights";
import { loadCommandCenterPriorities } from "@/lib/command-center-priorities";
import { digestEmailEnabled } from "@/lib/notification-digest";
import { sendEmailViaSmtp } from "@/lib/smtp-send";
import { FINANCE_MONTHLY_TARGET_EUR } from "@/lib/finance-ledger-stats";
import type { InsightsStats } from "@/lib/insights-stats";

export function shouldSendOpsWeeklyDigestToday(now = new Date()): boolean {
  if (process.env.OPS_WEEKLY_DIGEST_CRON === "0") return false;
  if (process.env.OPS_WEEKLY_DIGEST_FORCE === "1") return true;
  const target = Number(process.env.OPS_WEEKLY_DIGEST_WEEKDAY ?? "1");
  const tz = process.env.ONIZUKA_RECAP_TIMEZONE?.trim() || "Europe/Rome";
  const weekday = getWeekdayInTimezone(now, tz);
  return weekday === target;
}

function getWeekdayInTimezone(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? date.getUTCDay();
}

export function buildOpsWeeklyDigestText(
  stats: InsightsStats,
  recommendations: { title: string; detail: string }[],
  priorities: { title: string; detail: string }[],
  baseUrl: string
): string {
  const dateFmt = dateTimeFormatIt({ dateStyle: "full" });
  const lines = [
    `Onizuka — Riepilogo operativo`,
    dateFmt.format(new Date()),
    `Fuso recap: ${stats.timeZoneLabel}`,
    "",
    "=== KPI ===",
    `Clienti: ${stats.clientsTotal}`,
    `Lead attivi: ${stats.leadsOpen}`,
    `Opportunità aperte: ${stats.opportunitiesOpen}`,
    `Task Flow aperti: ${stats.flowOpen} (in ritardo: ${stats.flowOverdue}, senza scadenza: ${stats.flowNoDueDate})`,
    `Post in approvazione: ${stats.postsPending}`,
    `Ticket aperti: ${stats.openTickets}`,
    `Reach in attesa: ${stats.outreachPending}`,
    `Sequenze Reach attive: ${stats.activeReachSequences}`,
    `Voci memoria: ${stats.memoryTotal}`,
  ];

  if (stats.financeOverdueCount != null && stats.financeOverdueCount > 0) {
    lines.push(`Finance scaduti: ${stats.financeOverdueCount}`);
  }
  if (stats.financeGapEur != null && stats.financeGapEur > 0) {
    lines.push(
      `Gap cashflow vs target € ${FINANCE_MONTHLY_TARGET_EUR.toLocaleString("it-IT")}: € ${stats.financeGapEur.toLocaleString("it-IT")}`
    );
  }
  if (stats.clientsUpsell != null && stats.clientsUpsell > 0) {
    lines.push(`Clienti con upsell potenziale: ${stats.clientsUpsell}`);
  }
  if (stats.auditFollowUpTasks != null && stats.auditFollowUpTasks > 0) {
    lines.push(`Task follow-up audit: ${stats.auditFollowUpTasks}`);
  }

  if (priorities.length > 0) {
    lines.push("", "=== Priorità strategiche ===");
    priorities.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.title} — ${p.detail}`);
    });
  }

  if (recommendations.length > 0) {
    lines.push("", "=== Raccomandazioni ===");
    recommendations.slice(0, 8).forEach((r, i) => {
      lines.push(`${i + 1}. ${r.title} — ${r.detail}`);
    });
  }

  lines.push(
    "",
    `Command Center: ${baseUrl}/admin`,
    `Insights: ${baseUrl}/admin/insights`,
    `Finance: ${baseUrl}/admin/finance`,
    "",
    "— Onizuka"
  );

  return lines.join("\n");
}

export async function loadOpsWeeklyDigestForOwner(
  ownerUserId: string,
  userTimeZone: string | null | undefined
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const [insights, recon] = await Promise.all([
    loadInsightsStats(ownerUserId, userTimeZone),
    loadFinanceReconciliation(ownerUserId),
  ]);

  if (!insights.ok) return { ok: false, error: "Insights non disponibili." };

  const recommendations = [
    ...buildInsightRecommendations(insights.stats),
    ...(recon.ok ? buildFinanceReconciliationRecommendations(recon.report) : []),
  ];

  const priorities = await loadCommandCenterPriorities(ownerUserId, userTimeZone);
  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const text = buildOpsWeeklyDigestText(
    insights.stats,
    recommendations,
    priorities.map((p) => ({ title: p.title, detail: p.detail })),
    baseUrl
  );

  return { ok: true, text };
}

export async function sendOpsWeeklyDigestEmail(
  ownerUserId: string,
  userTimeZone: string | null | undefined,
  toEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!digestEmailEnabled()) {
    return { ok: false, error: "SMTP non configurato o NOTIFY_DIGEST_EMAIL=0." };
  }

  const loaded = await loadOpsWeeklyDigestForOwner(ownerUserId, userTimeZone);
  if (!loaded.ok) return loaded;

  const sent = await sendEmailViaSmtp({
    to: toEmail,
    subject: `[Onizuka] Riepilogo operativo settimanale`,
    text: loaded.text,
  });

  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true };
}

export async function sendOpsWeeklyDigestToAllAdmins(): Promise<{
  attempted: number;
  sent: number;
  errors: number;
}> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, timeZone: true },
  });

  let sent = 0;
  let errors = 0;
  for (const admin of admins) {
    if (!admin.email) {
      errors += 1;
      continue;
    }
    const result = await sendOpsWeeklyDigestEmail(admin.id, admin.timeZone, admin.email);
    if (result.ok) sent += 1;
    else errors += 1;
  }
  return { attempted: admins.length, sent, errors };
}
