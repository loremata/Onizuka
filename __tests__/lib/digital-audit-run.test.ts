import { COMMERCIAL_SERVICES, ECOSYSTEM_BRANDS } from "@/lib/commercial-catalog-seed";

describe("commercial catalog seed", () => {
  it("includes core ecosystem brands", () => {
    const slugs = ECOSYSTEM_BRANDS.map((b) => b.slug);
    expect(slugs).toContain("labseven");
    expect(slugs).toContain("studiopop");
    expect(slugs).toContain("doctorlead");
  });

  it("includes trackable services from master spec", () => {
    const slugs = COMMERCIAL_SERVICES.map((s) => s.slug);
    expect(slugs).toContain("website");
    expect(slugs).toContain("seo");
    expect(slugs).toContain("google-ads");
    expect(slugs).toContain("hosting");
  });
});
