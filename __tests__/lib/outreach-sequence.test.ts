import { buildAuditSequenceSteps, DEFAULT_AUDIT_SEQUENCE_DELAYS } from "@/lib/outreach-sequence";

describe("outreach sequence templates", () => {
  it("builds 5 steps at J+0, J+3, J+7, J+14, J+30", () => {
    const steps = buildAuditSequenceSteps({
      companyName: "Rossi S.r.l.",
      firstSubject: "Ciao",
      firstBody: "Body",
      priorityProblem: "SEO debole",
    });
    expect(steps).toHaveLength(DEFAULT_AUDIT_SEQUENCE_DELAYS.length);
    expect(steps.map((s) => s.delayDays)).toEqual([...DEFAULT_AUDIT_SEQUENCE_DELAYS]);

    // Step 0 = la bozza iniziale passa invariata.
    expect(steps[0]).toMatchObject({ delayDays: 0, subject: "Ciao", body: "Body" });

    // I follow-up sono personalizzati su azienda e problema prioritario.
    for (const step of steps.slice(1)) {
      expect(step.subject).toContain("Rossi S.r.l.");
      expect(step.body).toContain("seo debole");
    }
    expect(steps[2].delayDays).toBe(7);
    expect(steps[4].delayDays).toBe(30);
  });
});
