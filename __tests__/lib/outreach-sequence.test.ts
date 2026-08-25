import { buildAuditSequenceSteps, DEFAULT_AUDIT_SEQUENCE_DELAYS } from "@/lib/outreach-sequence";

describe("outreach sequence templates", () => {
  it("costruisce 3 passi a J+0, J+3, J+7 — i J+14/J+30 sono stati tolti (25/08)", () => {
    // Senza rilevamento risposte su OGNI canale, insistere a un mese di distanza
    // è il modo più costoso di farsi segnalare come spam: il ritmo è tre tocchi
    // in una settimana, poi il lead passa a freddo.
    const steps = buildAuditSequenceSteps({
      companyName: "Rossi S.r.l.",
      firstSubject: "Ciao",
      firstBody: "Body",
      priorityProblem: "SEO debole",
    });
    expect(steps).toHaveLength(DEFAULT_AUDIT_SEQUENCE_DELAYS.length);
    expect(steps.map((s) => s.delayDays)).toEqual([0, 3, 7]);

    // Step 0 = la bozza iniziale passa invariata.
    expect(steps[0]).toMatchObject({ delayDays: 0, subject: "Ciao", body: "Body" });

    // I follow-up sono personalizzati su azienda e problema prioritario.
    for (const step of steps.slice(1)) {
      expect(step.subject).toContain("Rossi S.r.l.");
      expect(step.body).toContain("seo debole");
    }
  });
});
