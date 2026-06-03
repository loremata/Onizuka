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

  it("builds a structured problem→solution email when findings are provided", () => {
    const { subject, body } = buildFirstAuditOutreachEmail({
      companyName: "Pizzeria Roma",
      priorityProblem: "Sito assente",
      overallScore: 38,
      findings: [
        { problem: "Sito assente o non orientato al business", improvement: "Sito web / presenza online", detail: "Nessun sito raggiungibile" },
        { problem: "Google Business Profile da ottimizzare", improvement: "Local SEO / gestione GBP" },
      ],
    });
    expect(subject).toContain("Pizzeria Roma");
    expect(subject).toContain("2 aree");
    expect(body).toContain("38/100");
    expect(body).toContain("Sito assente o non orientato al business");
    expect(body).toContain("Nessun sito raggiungibile");
    expect(body).toContain("✓ Local SEO / gestione GBP");
    expect(body).toContain("Online Station");
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
