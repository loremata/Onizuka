import type { ClientMacroCategory } from "@prisma/client";

/** Servizi catalogo «Cliente negozio» (utility / telecom). */
export const RETAIL_STORE_SERVICE_SLUGS = new Set([
  "mobile",
  "sim",
  "fiber",
  "fwa",
  "energy",
  "gas",
  "sky",
  "tim-vision",
  "streaming",
  "tv",
  "pbx",
]);

/** Servizi catalogo «Cliente digitale / AI». */
export const DIGITAL_AI_SERVICE_SLUGS = new Set([
  "website",
  "hosting",
  "domain",
  "maintenance",
  "seo",
  "google-ads",
  "meta-ads",
  "social-mgmt",
  "branding",
  "automations",
  "ai-consulting",
  "digital-audit",
  "consulting",
  "landing-page",
  "ecommerce",
]);

export function serviceSlugToMacro(slug: string): ClientMacroCategory {
  if (RETAIL_STORE_SERVICE_SLUGS.has(slug)) return "RETAIL_STORE";
  if (DIGITAL_AI_SERVICE_SLUGS.has(slug)) return "DIGITAL_AI";
  return "DIGITAL_AI";
}

export function macroCategoryForActiveSlugs(slugs: string[]): ClientMacroCategory {
  const hasRetail = slugs.some((s) => RETAIL_STORE_SERVICE_SLUGS.has(s));
  const hasDigital = slugs.some((s) => DIGITAL_AI_SERVICE_SLUGS.has(s));
  if (hasRetail && hasDigital) return "MIXED";
  if (hasRetail) return "RETAIL_STORE";
  return "DIGITAL_AI";
}
