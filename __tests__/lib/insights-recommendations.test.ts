import { buildInsightRecommendations } from "@/lib/insights-recommendations";

const base = {
  clientsTotal: 10,
  leadsOpen: 3,
  opportunitiesOpen: 2,
  flowOpen: 5,
  flowOverdue: 0,
  flowNoDueDate: 0,
  postsPending: 0,
  memoryTotal: 10,
  openTickets: 0,
  outreachPending: 0,
  activeReachSequences: 0,
  timeZoneLabel: "Europe/Rome",
};

describe("buildInsightRecommendations", () => {
  it("prioritizes overdue flow", () => {
    const r = buildInsightRecommendations({ ...base, flowOverdue: 2 });
    expect(r[0]?.id).toBe("flow-overdue");
  });

  it("includes tickets when open", () => {
    const r = buildInsightRecommendations({ ...base, openTickets: 1 });
    expect(r.some((x) => x.id === "tickets-open")).toBe(true);
  });
});
