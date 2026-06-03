import { buildFirstAuditOutreachEmail } from "@/lib/audit-outreach-draft";

describe("buildFirstAuditOutreachEmail", () => {
  it("uses brand template when slug known", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Demo Srl",
      priorityProblem: "SEO locale debole",
      brandSlug: "labseven",
      brandName: "LabSeven",
      serviceName: "SEO",
      overallScore: 42,
    });
    expect(subject).toContain("Demo Srl");
    expect(body).toContain("LabSeven");
    expect(body).toContain("42/100");
  });

  it("builds a structured gap→consequence→solution email without internal brands", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Pizzeria Roma",
      priorityProblem: "Sito assente",
      overallScore: 38,
      findings: [
        {
          gap: "il sito web è assente o poco orientato a generare contatti",
          consequence: "chi vi cerca online non trova un riferimento credibile",
          solution: "un sito professionale pensato per trasformare le visite in richieste",
        },
        {
          gap: "la presenza sui social è debole o incostante",
          consequence: "il vostro marchio resta poco riconoscibile",
          solution: "un progetto personalizzato di gestione dei social",
        },
      ],
    });
    expect(subject).toContain("Pizzeria Roma");
    expect(subject).toContain("2 aree");
    expect(body).toContain("consulenza gratuita");
    expect(body).toContain("report");
    expect(body).toContain("progetto personalizzato di gestione dei social");
    expect(body).toContain("Online Station");
    // nessun brand interno deve trapelare
    expect(body).not.toMatch(/StudioPop|DoctorLead|LabSeven|Brandity/i);
  });

  it("falls back to generic copy without template", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Bar",
      priorityProblem: "visibilità",
      brandSlug: "unknown-brand",
    });
    expect(subject).toContain("Bar");
    expect(body).toContain("visibilità");
  });
});
