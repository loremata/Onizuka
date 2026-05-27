import type { DigitalAuditSection } from "@prisma/client";
import { buildAuditOutreachKit } from "@/lib/audit-outreach-kit";

const sections: DigitalAuditSection[] = [
  {
    id: "1",
    digitalAuditId: "a",
    sectionKey: "WEBSITE",
    score: 30,
    positives: null,
    issues: "Sito lento",
    createdAt: new Date(),
  },
  {
    id: "2",
    digitalAuditId: "a",
    sectionKey: "SEO",
    score: 45,
    positives: null,
    issues: null,
    createdAt: new Date(),
  },
];

describe("buildAuditOutreachKit", () => {
  it("includes business name and linkedin/call script", () => {
    const kit = buildAuditOutreachKit({
      businessName: "Rossi Srl",
      overallScore: 42,
      priorityProblem: "SEO debole",
      brandName: "BrandX",
      serviceName: "SEO Pack",
      sections,
    });
    expect(kit.linkedInBody).toContain("Rossi Srl");
    expect(kit.linkedInBody).toContain("42/100");
    expect(kit.callScript).toContain("SCRIPT CALL");
    expect(kit.callScript).toContain("SEO Pack");
  });
});
