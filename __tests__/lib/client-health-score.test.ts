import { computeClientHealthScore } from "@/lib/client-health-score";

const base = {
  id: "c1",
  status: "ACTIVE_CLIENT" as const,
  opportunities: [{ status: "OPEN" as const, estimatedValue: 1000 }],
  openTickets: 0,
  overdueFinance: 0,
  overdueFlowTasks: 0,
  _count: {
    posts: 1,
    assets: 2,
    opportunities: 1,
    contacts: 1,
    tickets: 0,
    flowTasks: 0,
  },
};

describe("computeClientHealthScore", () => {
  it("cliente attivo senza alert è in banda healthy", () => {
    const r = computeClientHealthScore(base);
    expect(r.band).toBe("healthy");
    expect(r.score).toBeGreaterThanOrEqual(65);
  });

  it("ticket aperti abbassano lo score", () => {
    const r = computeClientHealthScore({ ...base, openTickets: 3 });
    expect(r.score).toBeLessThan(computeClientHealthScore(base).score);
    expect(r.nextAction).toMatch(/ticket/i);
  });
});
