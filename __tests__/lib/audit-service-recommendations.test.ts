import {
  AUDIT_SECTION_RECOMMENDATIONS,
  commercialPriorityFromAuditScore,
  pickAuditRecommendationFromSections,
} from "@/lib/audit-service-recommendations";

describe("audit-service-recommendations", () => {
  it("maps WEBSITE weakness to website service", () => {
    const rec = pickAuditRecommendationFromSections([
      { sectionKey: "WEBSITE", score: 20 },
      { sectionKey: "SEO", score: 80 },
    ]);
    expect(rec.serviceSlug).toBe("website");
    expect(rec.brandSlug).toBe("labseven");
    expect(rec.priorityProblem).toMatch(/Sito/);
  });

  it("maps SOCIAL weakness to studiopop", () => {
    const rec = pickAuditRecommendationFromSections([
      { sectionKey: "SOCIAL", score: 15 },
      { sectionKey: "BRAND", score: 90 },
    ]);
    expect(rec.brandSlug).toBe("studiopop");
    expect(rec.serviceSlug).toBe("social-mgmt");
  });

  it("covers all audit section keys centrally", () => {
    const keys = Object.keys(AUDIT_SECTION_RECOMMENDATIONS);
    expect(keys).toContain("LOCAL");
    expect(keys).toContain("ADV");
    expect(keys).toContain("CONVERSION");
    expect(keys.length).toBe(10);
  });

  it("assigns URGENT priority for very low scores", () => {
    expect(commercialPriorityFromAuditScore(30)).toBe("URGENT");
    expect(commercialPriorityFromAuditScore(75)).toBe("LOW");
  });
});
