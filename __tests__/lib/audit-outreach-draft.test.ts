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
