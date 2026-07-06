export type WebsiteProbeResult = {
  url: string;
  ok: boolean;
  statusCode?: number;
  responseMs?: number;
  https: boolean;
  title?: string;
  metaDescription?: string;
  hasForm: boolean;
  hasCtaKeywords: boolean;
  hasAnalyticsHint: boolean;
  hasFacebookLink: boolean;
  hasInstagramLink: boolean;
  hasLinkedInLink: boolean;
  hasGoogleMapsLink: boolean;
  hasRobotsTxt: boolean;
  hasSitemapXml: boolean;
  // --- Segnali profondi (analisi qualità, non solo presenza) ---
  titleLength?: number;
  metaDescriptionLength?: number;
  h1Count?: number;
  hasViewport?: boolean; // meta viewport = base del mobile-friendly
  hasStructuredData?: boolean; // JSON-LD schema.org
  structuredDataTypes?: string[];
  hasOpenGraph?: boolean; // condivisione social
  hasCanonical?: boolean;
  langAttr?: string;
  imgCount?: number;
  imgWithAlt?: number;
  hasTelLink?: boolean; // click-to-call
  hasWhatsAppLink?: boolean;
  hasMailto?: boolean;
  hasPrivacyLink?: boolean;
  hasCookieBanner?: boolean;
  hasFavicon?: boolean;
  analyticsTools?: string[]; // GA4, GTM, Meta Pixel…
  wordCount?: number;
  error?: string;
};

export function detectSocialLinksFromHtml(html: string): Pick<
  WebsiteProbeResult,
  "hasFacebookLink" | "hasInstagramLink" | "hasLinkedInLink" | "hasGoogleMapsLink"
> {
  return {
    hasFacebookLink: /facebook\.com\/|fb\.com\//i.test(html),
    hasInstagramLink: /instagram\.com\//i.test(html),
    hasLinkedInLink: /linkedin\.com\/(company|in)\//i.test(html),
    hasGoogleMapsLink:
      /google\.[a-z.]+\/maps|maps\.google\.com|g\.page\/|business\.google\.com/i.test(html),
  };
}

/** Estrae segnali di QUALITÀ (non solo presenza) da HTML grezzo + versione lowercase. */
export function extractRichSignals(
  rawHtml: string,
  lower: string
): Pick<
  WebsiteProbeResult,
  | "titleLength" | "metaDescriptionLength" | "h1Count" | "hasViewport"
  | "hasStructuredData" | "structuredDataTypes" | "hasOpenGraph" | "hasCanonical"
  | "langAttr" | "imgCount" | "imgWithAlt" | "hasTelLink" | "hasWhatsAppLink"
  | "hasMailto" | "hasPrivacyLink" | "hasCookieBanner" | "hasFavicon"
  | "analyticsTools" | "wordCount"
> {
  const title = rawHtml.match(/<title[^>]*>([^<]{1,300})/i)?.[1]?.trim();
  const metaDesc = rawHtml
    .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})/i)?.[1]
    ?.trim();

  // Dati strutturati JSON-LD (schema.org): raccogli i @type dichiarati.
  const sdTypes = new Set<string>();
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(rawHtml)) !== null) {
    for (const t of m[1].match(/"@type"\s*:\s*"([^"]+)"/gi) ?? []) {
      const val = t.match(/"@type"\s*:\s*"([^"]+)"/i)?.[1];
      if (val) sdTypes.add(val);
    }
  }

  // Strumenti analytics/tracking identificati per nome.
  const tools: string[] = [];
  if (/gtag\(|googletagmanager\.com\/gtag|G-[A-Z0-9]{6,}/i.test(rawHtml)) tools.push("Google Analytics 4");
  if (/googletagmanager\.com\/gtm|GTM-[A-Z0-9]{4,}/i.test(rawHtml)) tools.push("Google Tag Manager");
  if (/fbq\(|connect\.facebook\.net\/[^"']*fbevents/i.test(rawHtml)) tools.push("Meta Pixel");
  if (/hotjar\.com|static\.hotjar/i.test(rawHtml)) tools.push("Hotjar");
  if (/clarity\.ms/i.test(rawHtml)) tools.push("Microsoft Clarity");

  // Testo visibile approssimato → stima profondità contenuti.
  const text = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;

  const imgTags = rawHtml.match(/<img\b[^>]*>/gi) ?? [];
  const imgWithAlt = imgTags.filter((t) => /\balt\s*=\s*["'][^"']+["']/i.test(t)).length;

  return {
    titleLength: title ? title.length : 0,
    metaDescriptionLength: metaDesc ? metaDesc.length : 0,
    h1Count: (rawHtml.match(/<h1\b/gi) ?? []).length,
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(rawHtml),
    hasStructuredData: sdTypes.size > 0,
    structuredDataTypes: Array.from(sdTypes).slice(0, 12),
    hasOpenGraph: /<meta[^>]+property=["']og:/i.test(rawHtml),
    hasCanonical: /<link[^>]+rel=["']canonical["']/i.test(rawHtml),
    langAttr: rawHtml.match(/<html[^>]+lang=["']([a-z-]{2,5})["']/i)?.[1]?.toLowerCase(),
    imgCount: imgTags.length,
    imgWithAlt,
    hasTelLink: /href=["']tel:/i.test(rawHtml),
    hasWhatsAppLink: /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(lower),
    hasMailto: /href=["']mailto:/i.test(rawHtml),
    hasPrivacyLink: /privacy|cookie policy|informativa/i.test(lower),
    hasCookieBanner: /iubenda|cookiebot|onetrust|cookieyes|cookie-?consent|gdpr/i.test(lower),
    hasFavicon: /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(rawHtml),
    analyticsTools: tools,
    wordCount,
  };
}

const PROBE_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 120_000;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function mockProbeForE2E(url: string): WebsiteProbeResult {
  return {
    url,
    ok: true,
    statusCode: 200,
    responseMs: 5,
    https: url.startsWith("https://"),
    title: "E2E Mock Page",
    metaDescription: "Mock probe for Playwright E2E.",
    hasForm: true,
    hasCtaKeywords: true,
    hasAnalyticsHint: true,
    hasFacebookLink: false,
    hasInstagramLink: false,
    hasLinkedInLink: false,
    hasGoogleMapsLink: false,
    hasRobotsTxt: true,
    hasSitemapXml: true,
  };
}

async function probeSeoFiles(siteUrl: string): Promise<Pick<WebsiteProbeResult, "hasRobotsTxt" | "hasSitemapXml">> {
  const origin = new URL(siteUrl).origin;
  const out = { hasRobotsTxt: false, hasSitemapXml: false };
  const paths = ["/robots.txt", "/sitemap.xml", "/sitemap_index.xml"] as const;

  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${origin}${path}`, {
        signal: controller.signal,
        headers: { "User-Agent": "Onizuka-AuditBot/1.0 (+https://onizuka.it)" },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      if (path === "/robots.txt") out.hasRobotsTxt = true;
      if (path.startsWith("/sitemap")) out.hasSitemapXml = true;
    } catch {
      continue;
    }
  }

  return out;
}

function extractTag(html: string, pattern: RegExp): string | undefined {
  const m = html.match(pattern);
  return m?.[1]?.trim().replace(/\s+/g, " ");
}

export async function probeWebsite(rawUrl: string | null | undefined): Promise<WebsiteProbeResult | null> {
  const url = rawUrl ? normalizeUrl(rawUrl) : null;
  if (!url) return null;
  if (process.env.PLAYWRIGHT_E2E === "1") {
    return mockProbeForE2E(url);
  }

  const started = Date.now();
  const base: WebsiteProbeResult = {
    url,
    ok: false,
    https: url.startsWith("https://"),
    hasForm: false,
    hasCtaKeywords: false,
    hasAnalyticsHint: false,
    hasFacebookLink: false,
    hasInstagramLink: false,
    hasLinkedInLink: false,
    hasGoogleMapsLink: false,
    hasRobotsTxt: false,
    hasSitemapXml: false,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Onizuka-AuditBot/1.0 (+https://onizuka.it)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timer);
    base.responseMs = Date.now() - started;
    base.statusCode = res.status;
    base.ok = res.ok;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      base.error = "Risposta non HTML";
      return base;
    }

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
    const rawHtml = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    const html = rawHtml.toLowerCase();

    base.title = extractTag(rawHtml, /<title[^>]*>([^<]{1,200})/i);
    base.metaDescription = extractTag(rawHtml, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})/i);
    base.hasForm = /<form[\s>]/i.test(html);
    base.hasCtaKeywords = /\b(contatt|prenota|richied|preventiv|acquista|iscriv|scarica|call to action|cta)\b/i.test(
      html
    );
    base.hasAnalyticsHint =
      /googletagmanager|google-analytics|gtag\(|fbq\(|metapixel|analytics\.js/i.test(html);
    Object.assign(base, detectSocialLinksFromHtml(html));
    Object.assign(base, extractRichSignals(rawHtml, html));
    Object.assign(base, await probeSeoFiles(url));

    if (!base.metaDescription) {
      base.error = base.ok ? undefined : `HTTP ${res.status}`;
    }

    return base;
  } catch (e) {
    base.responseMs = Date.now() - started;
    base.error = e instanceof Error ? e.message : "Fetch fallito";
    return base;
  }
}

/** Aggiusta punteggi sezione WEBSITE/SEO/UX/TRACKING/CONVERSION da probe HTTP. */
export function applyWebsiteProbeToSections(
  sections: { sectionKey: string; score: number; positives: string; issues: string }[],
  probe: WebsiteProbeResult | null
): typeof sections {
  if (!probe) return sections;

  return sections.map((s) => {
    if (s.sectionKey === "WEBSITE") {
      let score = s.score;
      const pos: string[] = probe.title ? [`Titolo pagina: «${probe.title.slice(0, 80)}».`] : [];
      const issues: string[] = [];

      if (probe.ok) {
        score = Math.min(100, score + 15);
        pos.push(`Sito raggiungibile (HTTP ${probe.statusCode}, ${probe.responseMs}ms).`);
      } else {
        score = Math.max(10, score - 25);
        issues.push(probe.error ?? `Sito non raggiungibile (HTTP ${probe.statusCode ?? "?"})`);
      }
      if (!probe.https) {
        score = Math.max(10, score - 10);
        issues.push("Sito senza HTTPS.");
      }
      if (!probe.title) issues.push("Tag title assente o non leggibile.");

      return {
        ...s,
        score,
        positives: [s.positives, ...pos].filter(Boolean).join(" "),
        issues: [s.issues, ...issues].filter(Boolean).join(" "),
      };
    }

    if (s.sectionKey === "SEO") {
      let score = s.score;
      const issues: string[] = [];
      const positives: string[] = [];
      if (probe.metaDescription) {
        score = Math.min(100, score + 12);
      } else if (probe.ok) {
        score = Math.max(15, score - 15);
        issues.push("Meta description mancante.");
      }
      if ("subpagesOk" in probe) {
        const deep = probe as WebsiteDeepProbeResult;
        if (deep.subpagesOk > 0) {
          score = Math.min(100, score + deep.subpagesOk * 5);
          positives.push(`Pagine interne raggiungibili: ${deep.probedPaths.join(", ")}.`);
        }
      }
      if (probe.hasRobotsTxt) {
        score = Math.min(100, score + 4);
        positives.push("robots.txt presente.");
      }
      if (probe.hasSitemapXml) {
        score = Math.min(100, score + 6);
        positives.push("Sitemap XML rilevata.");
      } else if (probe.ok) {
        issues.push("Sitemap XML non trovata (robots/sitemap.xml).");
      }
      return {
        ...s,
        score,
        positives: [s.positives, ...positives].filter(Boolean).join(" "),
        issues: [s.issues, ...issues].filter(Boolean).join(" "),
      };
    }

    if (s.sectionKey === "UX" && probe.ok) {
      let score = s.score;
      if (probe.hasForm || probe.hasCtaKeywords) score = Math.min(100, score + 10);
      else score = Math.max(15, score - 8);
      return {
        ...s,
        score,
        issues: probe.hasCtaKeywords || probe.hasForm ? s.issues : [s.issues, "CTA/form non evidenti in homepage."].filter(Boolean).join(" "),
      };
    }

    if (s.sectionKey === "TRACKING") {
      let score = s.score;
      if (probe.hasAnalyticsHint) score = Math.min(100, score + 20);
      else if (probe.ok) score = Math.max(12, score - 10);
      return {
        ...s,
        score,
        positives: probe.hasAnalyticsHint ? [s.positives, "Snippet analytics rilevato."].filter(Boolean).join(" ") : s.positives,
        issues: probe.hasAnalyticsHint ? s.issues : [s.issues, "Nessun pixel analytics evidente in HTML."].filter(Boolean).join(" "),
      };
    }

    if (s.sectionKey === "CONVERSION" && probe.ok) {
      const score = probe.hasForm || probe.hasCtaKeywords ? Math.min(100, s.score + 8) : Math.max(18, s.score - 5);
      return { ...s, score };
    }

    if (s.sectionKey === "SOCIAL") {
      const channels = [
        probe.hasFacebookLink && "Facebook",
        probe.hasInstagramLink && "Instagram",
        probe.hasLinkedInLink && "LinkedIn",
      ].filter(Boolean) as string[];
      if (channels.length === 0) return s;
      return {
        ...s,
        score: Math.min(100, s.score + channels.length * 10),
        positives: [s.positives, `Link social in homepage: ${channels.join(", ")}.`].filter(Boolean).join(" "),
      };
    }

    if (s.sectionKey === "LOCAL" && probe.hasGoogleMapsLink) {
      return {
        ...s,
        score: Math.min(100, s.score + 12),
        positives: [s.positives, "Link Google Maps rilevato in homepage."].filter(Boolean).join(" "),
        issues: s.issues.replace(/Google Business Profile da verificare o collegare come asset\.?/i, "").trim(),
      };
    }

    return s;
  });
}

export type WebsiteDeepProbeResult = WebsiteProbeResult & {
  subpagesProbed: number;
  subpagesOk: number;
  probedPaths: string[];
};

const INNER_PATH_PATTERN =
  /\/(contatti|contact|chi-siamo|about|servizi|services|preventivo|quote)(?:\/|$|\?)/i;

function mergeProbeSignals(target: WebsiteProbeResult, sub: WebsiteProbeResult): void {
  target.hasForm = target.hasForm || sub.hasForm;
  target.hasCtaKeywords = target.hasCtaKeywords || sub.hasCtaKeywords;
  target.hasAnalyticsHint = target.hasAnalyticsHint || sub.hasAnalyticsHint;
  target.hasFacebookLink = target.hasFacebookLink || sub.hasFacebookLink;
  target.hasInstagramLink = target.hasInstagramLink || sub.hasInstagramLink;
  target.hasLinkedInLink = target.hasLinkedInLink || sub.hasLinkedInLink;
  target.hasGoogleMapsLink = target.hasGoogleMapsLink || sub.hasGoogleMapsLink;
}

async function discoverInnerPageUrls(baseUrl: string, max = 2): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(baseUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Onizuka-AuditBot/1.0 (+https://onizuka.it)",
        Accept: "text/html",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    const origin = new URL(baseUrl).origin;
    const seen = new Set<string>();
    const out: string[] = [];
    const re = /href=["']([^"'#]+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < max) {
      try {
        const abs = new URL(m[1], baseUrl);
        if (abs.origin !== origin) continue;
        if (!INNER_PATH_PATTERN.test(abs.pathname)) continue;
        const key = abs.pathname.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(abs.toString());
      } catch {
        continue;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Probe homepage + fino a 2 pagine interne (contatti, servizi, about…). */
export async function probeWebsiteWithSubpages(
  rawUrl: string | null | undefined
): Promise<WebsiteDeepProbeResult | null> {
  const home = await probeWebsite(rawUrl);
  if (!home) return null;

  const deep: WebsiteDeepProbeResult = {
    ...home,
    subpagesProbed: 0,
    subpagesOk: 0,
    probedPaths: [],
  };

  if (!home.ok) return deep;

  const innerUrls = await discoverInnerPageUrls(home.url, 2);
  for (const url of innerUrls) {
    deep.subpagesProbed += 1;
    const sub = await probeWebsite(url);
    if (sub?.ok) {
      deep.subpagesOk += 1;
      deep.probedPaths.push(new URL(url).pathname);
      mergeProbeSignals(deep, sub);
    }
  }

  return deep;
}
