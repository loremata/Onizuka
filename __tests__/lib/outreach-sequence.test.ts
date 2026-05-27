import { buildAuditSequenceSteps, DEFAULT_AUDIT_SEQUENCE_DELAYS } from "@/lib/outreach-sequence";

describe("outreach sequence templates", () => {
  it("builds 3 steps at J+0, J+3, J+7", () => {
    const steps = buildAuditSequenceSteps({
      companyName: "Rossi S.r.l.",
      firstSubject: "Ciao",
      firstBody: "Body",
      priorityProblem: "SEO debole",
    });
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.delayDays)).toEqual([...DEFAULT_AUDIT_SEQUENCE_DELAYS]);
    expect(steps[1].subject).toContain("Rossi S.r.l.");
    expect(steps[2].delayDays).toBe(7);
  });
});
