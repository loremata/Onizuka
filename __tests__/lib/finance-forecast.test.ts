import { weightedPipelineEur } from "@/lib/finance-forecast";

describe("weightedPipelineEur", () => {
  it("applies priority weights", () => {
    const sum = weightedPipelineEur([
      { estimatedValue: { toString: () => "1000" }, priority: "HIGH" },
      { estimatedValue: { toString: () => "1000" }, priority: "LOW" },
    ]);
    expect(Number(sum.replace(/\./g, "").replace(",", "."))).toBe(1000);
  });
});
