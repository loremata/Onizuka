import { applyWebsiteProbeToSections, detectSocialLinksFromHtml } from "@/lib/website-probe";
import type { WebsiteProbeResult } from "@/lib/website-probe";

describe("detectSocialLinksFromHtml", () => {
  it("detects social and maps links", () => {
    const html = `<a href="https://facebook.com/page">fb</a>
      <a href="https://instagram.com/brand">ig</a>
      <a href="https://maps.google.com/maps?q=roma">map</a>`;
    const links = detectSocialLinksFromHtml(html);
    expect(links.hasFacebookLink).toBe(true);
    expect(links.hasInstagramLink).toBe(true);
    expect(links.hasGoogleMapsLink).toBe(true);
    expect(links.hasLinkedInLink).toBe(false);
  });
});

describe("applyWebsiteProbeToSections", () => {
  const base = [
    { sectionKey: "WEBSITE", score: 50, positives: "", issues: "" },
    { sectionKey: "SEO", score: 50, positives: "", issues: "" },
    { sectionKey: "TRACKING", score: 30, positives: "", issues: "" },
  ];

  it("boosts WEBSITE when probe succeeds", () => {
    const probe: WebsiteProbeResult = {
      url: "https://example.com",
      ok: true,
      https: true,
      statusCode: 200,
      responseMs: 120,
      title: "Example",
      hasForm: true,
      hasCtaKeywords: true,
      hasAnalyticsHint: true,
      hasFacebookLink: true,
      hasInstagramLink: false,
      hasLinkedInLink: false,
      hasGoogleMapsLink: true,
      hasRobotsTxt: true,
      hasSitemapXml: true,
    };
    const out = applyWebsiteProbeToSections(
      [
        ...base,
        { sectionKey: "SOCIAL", score: 30, positives: "", issues: "" },
        { sectionKey: "LOCAL", score: 40, positives: "", issues: "Google Business Profile da verificare." },
      ],
      probe
    );
    const web = out.find((s) => s.sectionKey === "WEBSITE");
    expect(web?.score).toBeGreaterThan(50);
    const social = out.find((s) => s.sectionKey === "SOCIAL");
    expect(social?.score).toBeGreaterThan(30);
    const local = out.find((s) => s.sectionKey === "LOCAL");
    expect(local?.score).toBeGreaterThan(40);
  });
});
