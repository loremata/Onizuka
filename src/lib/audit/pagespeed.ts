// Collector Google PageSpeed Insights (Lighthouse) — segnale autorevole per l'audit.
// Gratis (v5). Degrado morbido: se manca la chiave, l'API è disabilitata o va in
// timeout, ritorna null e l'audit prosegue senza questi dati.
//
// Env: GOOGLE_PSI_API_KEY (dedicata) oppure fallback su GOOGLE_PLACES_API_KEY.

export type PageSpeedResult = {
  strategy: "mobile" | "desktop";
  /** Punteggi Lighthouse 0-100 (null se non disponibili). */
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  /** Metriche di laboratorio. */
  lcpMs: number | null; // Largest Contentful Paint
  cls: number | null; // Cumulative Layout Shift
  tbtMs: number | null; // Total Blocking Time (proxy INP in lab)
  fcpMs: number | null; // First Contentful Paint
  speedIndexMs: number | null;
  /** Dati reali degli utenti (CrUX), se il sito ha abbastanza traffico. */
  field: { lcpMs: number | null; cls: number | null; inpMs: number | null } | null;
  fetchedUrl: string;
};

function psiApiKey(): string | null {
  return (
    process.env.GOOGLE_PSI_API_KEY?.trim() ||
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    null
  );
}

export function isPageSpeedConfigured(): boolean {
  return Boolean(psiApiKey());
}

function scoreToPercent(score: unknown): number | null {
  return typeof score === "number" ? Math.round(score * 100) : null;
}

function auditMs(audits: Record<string, { numericValue?: number }> | undefined, key: string): number | null {
  const v = audits?.[key]?.numericValue;
  return typeof v === "number" ? Math.round(v) : null;
}

function fieldMetric(
  metrics: Record<string, { percentile?: number }> | undefined,
  key: string,
  divide = 1
): number | null {
  const p = metrics?.[key]?.percentile;
  return typeof p === "number" ? Math.round(p / divide) : null;
}

/**
 * Interroga PageSpeed Insights per un URL. `strategy` mobile è la più rilevante
 * (Google indicizza mobile-first). Timeout generoso: Lighthouse può impiegare 10-30s.
 */
export async function fetchPageSpeed(
  rawUrl: string,
  opts?: { strategy?: "mobile" | "desktop"; timeoutMs?: number }
): Promise<PageSpeedResult | null> {
  const key = psiApiKey();
  if (!key) return null;
  const strategy = opts?.strategy ?? "mobile";
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  for (const cat of ["performance", "seo", "accessibility", "best-practices"]) {
    endpoint.searchParams.append("category", cat);
  }
  endpoint.searchParams.set("key", key);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 45_000);
    const res = await fetch(endpoint.toString(), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>;
        audits?: Record<string, { numericValue?: number }>;
      };
      loadingExperience?: { metrics?: Record<string, { percentile?: number }> };
    };

    const cats = data.lighthouseResult?.categories;
    const audits = data.lighthouseResult?.audits;
    const fieldMetrics = data.loadingExperience?.metrics;

    const field = fieldMetrics
      ? {
          lcpMs: fieldMetric(fieldMetrics, "LARGEST_CONTENTFUL_PAINT_MS"),
          cls: (() => {
            const raw = fieldMetric(fieldMetrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE");
            return raw != null ? raw / 100 : null; // CrUX riporta CLS ×100
          })(),
          inpMs: fieldMetric(fieldMetrics, "INTERACTION_TO_NEXT_PAINT"),
        }
      : null;

    return {
      strategy,
      performance: scoreToPercent(cats?.performance?.score),
      seo: scoreToPercent(cats?.seo?.score),
      accessibility: scoreToPercent(cats?.accessibility?.score),
      bestPractices: scoreToPercent(cats?.["best-practices"]?.score),
      lcpMs: auditMs(audits, "largest-contentful-paint"),
      cls: (() => {
        const v = audits?.["cumulative-layout-shift"]?.numericValue;
        return typeof v === "number" ? Math.round(v * 1000) / 1000 : null;
      })(),
      tbtMs: auditMs(audits, "total-blocking-time"),
      fcpMs: auditMs(audits, "first-contentful-paint"),
      speedIndexMs: auditMs(audits, "speed-index"),
      field: field && (field.lcpMs || field.cls || field.inpMs) ? field : null,
      fetchedUrl: url,
    };
  } catch {
    return null;
  }
}
