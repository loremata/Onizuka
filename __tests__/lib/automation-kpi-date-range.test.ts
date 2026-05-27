import { resolveAutomationKpiRange } from "@/lib/automation-kpi-date-range";

describe("resolveAutomationKpiRange", () => {
  it("defaults to a 7-day window when params missing", () => {
    const r = resolveAutomationKpiRange({});
    expect(r.to.getTime()).toBeGreaterThanOrEqual(r.from.getTime());
    const spanMs = r.to.getTime() - r.from.getTime();
    expect(spanMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(spanMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it("swaps inverted from/to", () => {
    const r = resolveAutomationKpiRange({ from: "2026-01-10", to: "2026-01-05" });
    expect(r.fromDay <= r.toDay).toBe(true);
    expect(r.fromDay).toBe("2026-01-05");
    expect(r.toDay).toBe("2026-01-10");
  });

  it("ignores invalid day strings", () => {
    const r = resolveAutomationKpiRange({ from: "not-a-date", to: "also-bad" });
    expect(r.fromDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.toDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
