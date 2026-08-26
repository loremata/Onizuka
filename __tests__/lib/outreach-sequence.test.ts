import { buildAuditSequenceSteps, DEFAULT_AUDIT_SEQUENCE_DELAYS } from "@/lib/outreach-sequence";

describe("outreach sequence templates", () => {
  it("costruisce 3 passi a J+0, J+3, J+7 col nome commerciale pulito", () => {
    const steps = buildAuditSequenceSteps({
      companyName: "Trattoria Il Ponte S.r.l.",
      firstSubject: "Ciao",
      firstBody: "Body",
      priorityProblem: "SEO debole",
    });
    expect(steps).toHaveLength(DEFAULT_AUDIT_SEQUENCE_DELAYS.length);
    expect(steps.map((s) => s.delayDays)).toEqual([0, 3, 7]);

    // Step 0 = la bozza iniziale passa invariata.
    expect(steps[0]).toMatchObject({ delayDays: 0, subject: "Ciao", body: "Body" });

    // Il nome arriva pulito nei follow-up (niente forma giuridica da visura).
    // nomeCommerciale normalizza gli articoli interni ("Il" → "il"): giusto così.
    expect(steps[1].subject).toBe("Torno un attimo da voi — Trattoria il Ponte");
    expect(steps[2].subject).toBe("Ultimo messaggio, promesso — Trattoria il Ponte");
    for (const step of steps.slice(1)) {
      expect(step.subject).not.toMatch(/s\.?r\.?l/i);
    }
  });

  it("i follow-up sono in «voi», senza «Re:» finto, gergo o stringhe-diagnosi", () => {
    // La revisione del 26/08: il vecchio J+3 aveva «Re:» in oggetto, il tu e
    // il voi nella stessa frase e la diagnosi di sistema incollata a crudo.
    const steps = buildAuditSequenceSteps({
      companyName: "Trattoria Il Ponte",
      firstSubject: "x",
      firstBody: "y",
      priorityProblem: "presenza social debole o incoerente",
    });
    const j3 = steps[1];
    const j7 = steps[2];

    expect(j3.subject).not.toMatch(/^Re:/i);
    for (const s of [j3, j7]) {
      expect(s.body).not.toMatch(/\bfollow-up\b|\bslot\b/i);
      expect(s.body).not.toContain("presenza social debole o incoerente");
      // niente seconda persona singolare: ti/dimmi/vuoi tradiscono lo stampo
      expect(s.body).not.toMatch(/\b(ti|dimmi|se vuoi|preferisci)\b/i);
      expect(s.body).toMatch(/\bvi\b|\bvostra\b/i);
    }
    // Il congedo porta la firma territoriale: l'invito in negozio.
    expect(j7.body).toContain("Via Vecchia Aurelia 393");
    expect(j7.body).toContain("caffè");
  });

  it("nome di persona o assente → niente nome in oggetto, testo al generico", () => {
    const steps = buildAuditSequenceSteps({
      companyName: "Mario Rossi",
      firstSubject: "x",
      firstBody: "y",
    });
    expect(steps[1].subject).toBe("Torno un attimo da voi");
    expect(steps[1].body).toContain("della vostra attività");
    expect(steps[1].body).not.toContain("Mario Rossi");
  });
});
