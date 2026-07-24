/**
 * Test deterministici del motore pipeline up/cross-sell
 * (src/lib/customer-pipeline.ts) portato dall'app Customer Scoring.
 */

import {
  computeCustomerPipeline,
  netAnnualizedEurOf,
  type CustomerPipelineInput,
} from "@/lib/customer-pipeline";
import { PROBABILITY_CAP, SERVICE_ECONOMICS } from "@/lib/customer-value-config";

function input(overrides: Partial<CustomerPipelineInput>): CustomerPipelineInput {
  return {
    ownedServiceSlugs: new Set<string>(),
    isBusiness: false,
    macroCategory: null,
    score: 40,
    ...overrides,
  };
}

describe("computeCustomerPipeline", () => {
  it("cliente solo-mobile: propone fiber con prob 0.50, in cima alle proposte telco", () => {
    const out = computeCustomerPipeline(input({ ownedServiceSlugs: new Set(["mobile"]) }));
    const fiber = out.find((o) => o.serviceSlug === "fiber");
    expect(fiber).toBeDefined();
    expect(fiber!.probability).toBe(0.5);
    // Tra le proposte telco (fiber/sky/telepass) fiber ha il valore atteso più alto.
    const telco = out.filter((o) => ["fiber", "sky", "telepass"].includes(o.serviceSlug));
    expect(telco[0]!.serviceSlug).toBe("fiber");
    // Non ripropone ciò che possiede già.
    expect(out.some((o) => o.serviceSlug === "mobile")).toBe(false);
  });

  it("business con website+social: meta-ads presente e branding con boost business", () => {
    const out = computeCustomerPipeline(
      input({
        ownedServiceSlugs: new Set(["website", "social-mgmt"]),
        isBusiness: true,
        score: 60,
      }),
    );
    const metaAds = out.find((o) => o.serviceSlug === "meta-ads");
    expect(metaAds).toBeDefined();
    expect(metaAds!.probability).toBe(0.4);
    const googleAds = out.find((o) => o.serviceSlug === "google-ads");
    expect(googleAds!.probability).toBe(0.35);
    const branding = out.find((o) => o.serviceSlug === "branding");
    expect(branding).toBeDefined();
    expect(branding!.probability).toBeCloseTo(0.4); // 0.25 base + 0.15 business
  });

  it("rispetta il cap PROBABILITY_CAP su ogni opportunità", () => {
    // Cliente "massimale": tanti trigger attivi contemporaneamente.
    const out = computeCustomerPipeline(
      input({
        ownedServiceSlugs: new Set(["mobile", "gas", "website", "social-mgmt"]),
        isBusiness: true,
        macroCategory: "DIGITAL_AI",
        score: 90,
      }),
    );
    expect(out.length).toBeGreaterThan(0);
    for (const o of out) {
      expect(o.probability).toBeLessThanOrEqual(PROBABILITY_CAP);
    }
    // energy: base 0.55 (ha gas) + 0.15 (score ≥ 55) = 0.70, sotto il cap.
    const energy = out.find((o) => o.serviceSlug === "energy");
    expect(energy!.probability).toBeCloseTo(0.7);
  });

  it("dedup per slug: nessuna opportunità duplicata", () => {
    const out = computeCustomerPipeline(
      input({
        ownedServiceSlugs: new Set(["mobile", "fiber", "energy", "website", "social-mgmt"]),
        isBusiness: true,
        score: 80,
      }),
    );
    const slugs = out.map((o) => o.serviceSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("expectedValue = round(netAnnualized × probability)", () => {
    const out = computeCustomerPipeline(
      input({ ownedServiceSlugs: new Set(["website"]), score: 40 }),
    );
    for (const o of out) {
      expect(o.expectedValueEur).toBe(Math.round(o.netAnnualizedEur * o.probability));
    }
    // Servizio monthly annualizzato su 12 mesi: seo 112 × 12 × 0.45 = 604.8 → 605.
    const seo = out.find((o) => o.serviceSlug === "seo");
    expect(seo).toBeDefined();
    expect(seo!.netAnnualizedEur).toBe(SERVICE_ECONOMICS.seo.netUnitEur * 12);
    expect(seo!.expectedValueEur).toBe(605);
    expect(netAnnualizedEurOf("seo")).toBe(1344);
  });

  it("ordina per valore atteso decrescente", () => {
    const out = computeCustomerPipeline(
      input({
        ownedServiceSlugs: new Set(["mobile", "website", "social-mgmt"]),
        isBusiness: true,
        score: 75,
      }),
    );
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.expectedValueEur).toBeGreaterThanOrEqual(out[i]!.expectedValueEur);
    }
  });
});
