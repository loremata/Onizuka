import {
  buildOpsWeeklyDigestText,
  shouldSendOpsWeeklyDigestToday,
} from "@/lib/ops-weekly-digest";
import type { InsightsStats } from "@/lib/insights-stats";

const baseStats: InsightsStats = {
  clientsTotal: 10,
  leadsOpen: 2,
  opportunitiesOpen: 3,
  flowOpen: 5,
  flowOverdue: 1,
  flowNoDueDate: 2,
  postsPending: 0,
  memoryTotal: 8,
  openTickets: 1,
  outreachPending: 0,
  activeReachSequences: 1,
  timeZoneLabel: "Europe/Rome",
};

describe("ops-weekly-digest", () => {
  it("builds digest with KPI and recommendations", () => {
    const text = buildOpsWeeklyDigestText(
      baseStats,
      [{ title: "Recupera task", detail: "1 in ritardo" }],
      [{ title: "Finance", detail: "Gap target" }],
      "https://onizuka.it"
    );
    expect(text).toContain("Onizuka — Riepilogo operativo");
    expect(text).toContain("Clienti: 10");
    expect(text).toContain("Recupera task");
    expect(text).toContain("https://onizuka.it/admin");
  });

  it("respects OPS_WEEKLY_DIGEST_FORCE", () => {
    const prev = process.env.OPS_WEEKLY_DIGEST_FORCE;
    process.env.OPS_WEEKLY_DIGEST_FORCE = "1";
    expect(shouldSendOpsWeeklyDigestToday()).toBe(true);
    process.env.OPS_WEEKLY_DIGEST_FORCE = prev;
  });

  it("skips when OPS_WEEKLY_DIGEST_CRON=0", () => {
    const prev = process.env.OPS_WEEKLY_DIGEST_CRON;
    process.env.OPS_WEEKLY_DIGEST_CRON = "0";
    process.env.OPS_WEEKLY_DIGEST_FORCE = "0";
    expect(shouldSendOpsWeeklyDigestToday()).toBe(false);
    process.env.OPS_WEEKLY_DIGEST_CRON = prev;
  });
});
