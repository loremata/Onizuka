import { orchestrateAsk } from "@/lib/ask-orchestration";

describe("orchestrateAsk", () => {
  it("routes pipeline with follow-ups", () => {
    const plan = orchestrateAsk("pipeline");
    expect(plan.primaryHref).toBe("/admin/crm/pipeline");
    expect(plan.followUps.some((f) => f.href.includes("opportunities"))).toBe(true);
    expect(plan.summary.length).toBeGreaterThan(5);
  });

  it("routes search queries", () => {
    const plan = orchestrateAsk("cerca Demo");
    expect(plan.primary.kind).toBe("search");
    expect(plan.primaryHref).toContain("q=");
  });
});
