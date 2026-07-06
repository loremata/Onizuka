// Motore di scoring dell'audit digitale — versione "professionista".
// Ogni punteggio (0-100) nasce da SEGNALI MISURATI (PageSpeed, HTML reale, Google
// Business Profile), non da metadati del CRM. Ogni sezione produce anche testi
// specifici e difendibili (niente placeholder tipo "roadmap"/"MVP").
import type { DigitalAuditSectionKey } from "@prisma/client";
import type { WebsiteDeepProbeResult } from "@/lib/website-probe";
import type { PageSpeedResult } from "@/lib/audit/pagespeed";

export type AuditSectionResult = {
  sectionKey: DigitalAuditSectionKey;
  score: number;
  positives: string;
  issues: string;
};

export type AuditGbpSignals = {
  hasGbp: boolean;
  rating: number | null;
  reviewCount: number | null;
  categories: string[];
  hasHours: boolean;
  photoCount: number;
};

export type AuditSignals = {
  hasWebsite: boolean;
  probe: WebsiteDeepProbeResult | null;
  psi: PageSpeedResult | null;
  gbp: AuditGbpSignals;
  city?: string | null;
};

/** Metriche strutturate per il report premium (numeri autorevoli in evidenza). */
export type AuditMetrics = {
  hasWebsite: boolean;
  siteReachable: boolean | null;
  https: boolean | null;
  responseMs: number | null;
  mobileFriendly: boolean | null;
  pagespeed: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
    fromField: boolean;
  } | null;
  seo: {
    titleLength: number | null;
    metaDescriptionLength: number | null;
    h1Count: number | null;
    structuredData: string[];
    hasSitemap: boolean | null;
    hasCanonical: boolean | null;
  };
  tracking: string[];
  social: string[];
  contact: { form: boolean; phone: boolean; whatsapp: boolean; email: boolean };
  images: { total: number | null; withAlt: number | null };
  gbp: AuditGbpSignals;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const join = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Etichetta qualitativa da punteggio 0-100 (per copy). */
export function scoreLabel(score: number): string {
  if (score >= 80) return "ottimo";
  if (score >= 65) return "buono";
  if (score >= 45) return "migliorabile";
  if (score >= 30) return "debole";
  return "critico";
}

export function scoreAudit(signals: AuditSignals): {
  sections: AuditSectionResult[];
  metrics: AuditMetrics;
  overallScore: number;
} {
  const { probe, psi, gbp } = signals;
  const up = Boolean(probe?.ok);
  const hasWebsite = signals.hasWebsite && Boolean(probe);

  const sections: AuditSectionResult[] = [];

  // ---------------------------------------------------------------- WEBSITE
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let score: number;
    if (!signals.hasWebsite) {
      score = 12;
      iss.push("Nessun sito web: chi vi cerca su Google non trova un riferimento credibile e si rivolge ai concorrenti.");
    } else if (!up) {
      score = 22;
      iss.push(`Il sito risulta non raggiungibile${probe?.statusCode ? ` (HTTP ${probe.statusCode})` : ""}: ogni visitatore che ci prova è un contatto perso.`);
    } else {
      // Con PageSpeed la performance guida; altrimenti stima da raggiungibilità/tempi.
      const perf = psi?.performance ?? null;
      let base = perf != null ? 30 + perf * 0.55 : 58;
      if (probe?.https) { base += 6; pos.push("Connessione sicura HTTPS attiva."); }
      else { base -= 16; iss.push("Sito senza HTTPS: browser e clienti lo segnalano come «non sicuro»."); }
      if (probe?.hasViewport) { base += 6; pos.push("Impostazione mobile (viewport) presente."); }
      else { base -= 12; iss.push("Manca la configurazione mobile di base: su smartphone il sito rischia di essere inutilizzabile."); }
      if (probe?.hasFavicon) base += 2;
      if (typeof probe?.responseMs === "number") {
        if (probe.responseMs > 2500) iss.push(`Tempo di risposta lento (${(probe.responseMs / 1000).toFixed(1)}s al primo byte).`);
        else pos.push(`Sito raggiungibile in ${probe.responseMs} ms.`);
      }
      if (perf != null) {
        (perf >= 70 ? pos : iss).push(`Performance Google (mobile): ${perf}/100${psi?.lcpMs ? `, caricamento contenuto principale ${(psi.lcpMs / 1000).toFixed(1)}s` : ""}.`);
      }
      score = clamp(base);
    }
    sections.push({ sectionKey: "WEBSITE", score, positives: join(pos), issues: join(iss) });
  }

  // -------------------------------------------------------------------- SEO
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let base = up ? 45 : 22;
    if (!hasWebsite) {
      base = 20;
      iss.push("Senza sito non c'è visibilità organica: siete assenti dalle ricerche di chi cerca i vostri servizi.");
    } else if (up) {
      const tl = probe?.titleLength ?? 0;
      if (tl === 0) { base -= 12; iss.push("Tag title assente: Google non capisce di cosa parla la pagina."); }
      else if (tl < 30 || tl > 65) { base -= 4; iss.push(`Title da ottimizzare (${tl} caratteri, ideale 30-60).`); }
      else { base += 8; pos.push("Title presente e di lunghezza corretta."); }

      const ml = probe?.metaDescriptionLength ?? 0;
      if (ml === 0) { base -= 8; iss.push("Meta description mancante: nei risultati Google appare un testo casuale, meno cliccabile."); }
      else if (ml < 80 || ml > 165) { base -= 2; iss.push(`Meta description da tarare (${ml} caratteri, ideale 120-160).`); }
      else { base += 6; pos.push("Meta description ottimizzata."); }

      if ((probe?.h1Count ?? 0) === 0) { base -= 6; iss.push("Manca un titolo H1 chiaro nella pagina."); }
      else base += 3;
      if (probe?.hasStructuredData) { base += 8; pos.push(`Dati strutturati schema.org presenti${probe.structuredDataTypes?.length ? ` (${probe.structuredDataTypes.slice(0, 3).join(", ")})` : ""}.`); }
      else { base -= 6; iss.push("Nessun dato strutturato (schema.org): Google mostra meno informazioni ricche del vostro sito."); }
      if (probe?.hasSitemapXml) { base += 4; pos.push("Sitemap XML rilevata."); } else iss.push("Sitemap XML non trovata.");
      if (probe?.hasRobotsTxt) base += 2;
      if (probe?.hasCanonical) base += 2;
      if (!probe?.langAttr) iss.push("Attributo lingua (lang) non dichiarato.");
      if (psi?.seo != null) { base = base * 0.6 + psi.seo * 0.4; (psi.seo >= 80 ? pos : iss).push(`Punteggio SEO tecnico Google: ${psi.seo}/100.`); }
    }
    sections.push({ sectionKey: "SEO", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // ------------------------------------------------------------------ LOCAL
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let base = 35;
    if (gbp.hasGbp) {
      base = 60;
      pos.push("Scheda Google Business Profile presente.");
      if (gbp.categories.length) pos.push(`Categoria: ${gbp.categories.slice(0, 2).join(", ")}.`);
      if (gbp.hasHours) {
        base += 7;
        pos.push("Orari di apertura pubblicati.");
      } else {
        base -= 6;
        iss.push("Orari di apertura non pubblicati sulla scheda: chi cerca «aperto ora» rischia di non trovarvi.");
      }
      if (gbp.photoCount >= 5) {
        base += 7;
        pos.push(`${gbp.photoCount} foto sulla scheda.`);
      } else if (gbp.photoCount > 0) {
        base += 2;
        iss.push(`Poche foto sulla scheda (${gbp.photoCount}): le schede con più foto ricevono più contatti.`);
      } else {
        base -= 5;
        iss.push("Nessuna foto sulla scheda Google: le schede con foto ricevono molte più richieste.");
      }
      if (probe?.hasGoogleMapsLink) {
        base += 6;
        pos.push("Sito collegato alla scheda Maps.");
      } else {
        iss.push("La scheda Google non è collegata dal sito: si perde traffico e autorevolezza locale.");
      }
    } else {
      iss.push("Google Business Profile assente o non ottimizzato: è lo strumento n.1 per farsi trovare in zona ed è probabilmente la vostra più grande occasione persa.");
      if (probe?.hasGoogleMapsLink) { base += 8; pos.push("Rilevato un riferimento a Google Maps sul sito."); }
    }
    sections.push({ sectionKey: "LOCAL", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // ---------------------------------------------------------------- REVIEWS
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let base = 35;
    const rc = gbp.reviewCount ?? 0;
    const rating = gbp.rating ?? null;
    if (gbp.hasGbp && (rc > 0 || rating != null)) {
      if (rc >= 100) { base = 82; pos.push(`Ottima reputazione: ${rc} recensioni Google.`); }
      else if (rc >= 40) { base = 70; pos.push(`Buon numero di recensioni (${rc}).`); }
      else if (rc >= 10) { base = 56; iss.push(`Recensioni ancora poche (${rc}): sotto la soglia che rassicura un nuovo cliente.`); }
      else { base = 40; iss.push(`Solo ${rc} recensioni: chi sceglie in zona si fida prima di chi ne ha di più.`); }
      if (rating != null) {
        if (rating >= 4.5) { base += 6; pos.push(`Valutazione media eccellente (${rating}/5).`); }
        else if (rating >= 4.0) pos.push(`Valutazione media ${rating}/5.`);
        else { base -= 8; iss.push(`Valutazione media da migliorare (${rating}/5): serve una strategia di gestione recensioni.`); }
      }
    } else {
      base = 30;
      iss.push("Nessuna recensione Google rilevabile: manca completamente la riprova sociale che oggi decide gli acquisti.");
    }
    sections.push({ sectionKey: "REVIEWS", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // ----------------------------------------------------------------- SOCIAL
  {
    const pos: string[] = [];
    const iss: string[] = [];
    const channels = [
      probe?.hasFacebookLink && "Facebook",
      probe?.hasInstagramLink && "Instagram",
      probe?.hasLinkedInLink && "LinkedIn",
    ].filter(Boolean) as string[];
    let base = 28;
    if (channels.length >= 2) { base = 60; pos.push(`Canali social collegati dal sito: ${channels.join(", ")}.`); }
    else if (channels.length === 1) { base = 44; pos.push(`Un canale social collegato (${channels[0]}).`); iss.push("Presenza social limitata a un solo canale."); }
    else { base = 26; iss.push("Nessun canale social collegato dal sito: il marchio resta poco riconoscibile e perde occasioni di contatto."); }
    sections.push({ sectionKey: "SOCIAL", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // -------------------------------------------------------------------- ADV
  {
    const pos: string[] = [];
    const iss: string[] = [];
    const tools = probe?.analyticsTools ?? [];
    const hasPixel = tools.includes("Meta Pixel");
    const hasGads = tools.includes("Google Analytics 4") || tools.includes("Google Tag Manager");
    let base = 30;
    if (hasPixel) { base += 18; pos.push("Meta Pixel presente: infrastruttura per campagne e retargeting già installata."); }
    if (hasGads) base += 8;
    if (!hasPixel && !hasGads) iss.push("Nessuna infrastruttura pubblicitaria rilevata (pixel/tag): la crescita dipende solo dal passaparola, non è prevedibile né scalabile.");
    else iss.push("Verificare che le campagne siano attive e ottimizzate sul ritorno (ROAS), non solo installate.");
    sections.push({ sectionKey: "ADV", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // --------------------------------------------------------------------- UX
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let base = up ? 45 : 20;
    if (hasWebsite && up) {
      if (probe?.hasViewport) base += 8; else { base -= 10; iss.push("Sito non adatto al mobile: la maggioranza delle visite arriva da smartphone."); }
      if (probe?.hasForm || probe?.hasCtaKeywords) { base += 8; pos.push("Elementi di contatto/CTA presenti in pagina."); }
      else { base -= 8; iss.push("Nessuna call-to-action o form evidente: il visitatore non sa cosa fare dopo."); }
      const imgs = probe?.imgCount ?? 0;
      const alt = probe?.imgWithAlt ?? 0;
      if (imgs > 0 && alt / imgs < 0.5) { base -= 4; iss.push(`Molte immagini senza testo alternativo (${alt}/${imgs}): penalizza accessibilità e SEO.`); }
      if (psi?.accessibility != null) { base = base * 0.65 + psi.accessibility * 0.35; (psi.accessibility >= 80 ? pos : iss).push(`Accessibilità Google: ${psi.accessibility}/100.`); }
    } else if (!hasWebsite) {
      iss.push("Senza sito non c'è alcuna esperienza utente da offrire.");
    }
    sections.push({ sectionKey: "UX", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // ------------------------------------------------------------- CONVERSION
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let base = up ? 40 : 18;
    if (hasWebsite && up) {
      const methods = [
        probe?.hasForm && "form di contatto",
        probe?.hasTelLink && "click-to-call",
        probe?.hasWhatsAppLink && "WhatsApp",
        probe?.hasMailto && "email",
      ].filter(Boolean) as string[];
      if (methods.length >= 2) { base += 14; pos.push(`Più modi per farsi contattare: ${methods.join(", ")}.`); }
      else if (methods.length === 1) { base += 4; iss.push(`Un solo canale di contatto diretto (${methods[0]}): ogni attrito riduce le richieste.`); }
      else { base -= 12; iss.push("Nessun contatto diretto evidente (form/telefono/WhatsApp): il traffico non si trasforma in richieste."); }
      if (probe?.hasCtaKeywords) base += 6;
    } else if (!hasWebsite) {
      iss.push("Senza sito manca il punto di raccolta dei contatti online.");
    }
    sections.push({ sectionKey: "CONVERSION", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // --------------------------------------------------------------- TRACKING
  {
    const pos: string[] = [];
    const iss: string[] = [];
    const tools = probe?.analyticsTools ?? [];
    let base = up ? 30 : 15;
    if (tools.length > 0) { base = 72 + (tools.length - 1) * 6; pos.push(`Strumenti di misurazione attivi: ${tools.join(", ")}.`); }
    else if (up) iss.push("Nessuno strumento di analytics rilevato: le scelte di marketing vanno a intuito, senza sapere cosa funziona e quanto costa un contatto.");
    sections.push({ sectionKey: "TRACKING", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  // ------------------------------------------------------------------ BRAND
  {
    const pos: string[] = [];
    const iss: string[] = [];
    let base = up ? 42 : 26;
    if (hasWebsite && up) {
      if (probe?.hasOpenGraph) { base += 10; pos.push("Anteprime social (Open Graph) configurate: i link condivisi appaiono curati."); }
      else { base -= 6; iss.push("Anteprime social (Open Graph) assenti: quando qualcuno condivide il vostro link appare grezzo e poco professionale."); }
      const orgSchema = (probe?.structuredDataTypes ?? []).some((t) => /organization|localbusiness/i.test(t));
      if (orgSchema) { base += 8; pos.push("Identità aziendale dichiarata a Google (schema Organization/LocalBusiness)."); }
      if (probe?.hasFavicon) base += 2; else iss.push("Favicon assente: manca un dettaglio di riconoscibilità del marchio.");
      if (probe?.hasPrivacyLink || probe?.hasCookieBanner) { base += 4; pos.push("Elementi di conformità (privacy/cookie) presenti."); }
    }
    sections.push({ sectionKey: "BRAND", score: clamp(base), positives: join(pos), issues: join(iss) });
  }

  const overallScore = Math.round(sections.reduce((s, x) => s + x.score, 0) / sections.length);

  const metrics: AuditMetrics = {
    hasWebsite: signals.hasWebsite,
    siteReachable: probe ? probe.ok : null,
    https: probe ? probe.https : null,
    responseMs: probe?.responseMs ?? null,
    mobileFriendly: probe ? Boolean(probe.hasViewport) : null,
    pagespeed: psi
      ? {
          performance: psi.performance,
          seo: psi.seo,
          accessibility: psi.accessibility,
          bestPractices: psi.bestPractices,
          lcpMs: psi.field?.lcpMs ?? psi.lcpMs,
          cls: psi.field?.cls ?? psi.cls,
          tbtMs: psi.tbtMs,
          fromField: Boolean(psi.field),
        }
      : null,
    seo: {
      titleLength: probe?.titleLength ?? null,
      metaDescriptionLength: probe?.metaDescriptionLength ?? null,
      h1Count: probe?.h1Count ?? null,
      structuredData: probe?.structuredDataTypes ?? [],
      hasSitemap: probe ? Boolean(probe.hasSitemapXml) : null,
      hasCanonical: probe ? Boolean(probe.hasCanonical) : null,
    },
    tracking: probe?.analyticsTools ?? [],
    social: [
      probe?.hasFacebookLink && "Facebook",
      probe?.hasInstagramLink && "Instagram",
      probe?.hasLinkedInLink && "LinkedIn",
    ].filter(Boolean) as string[],
    contact: {
      form: Boolean(probe?.hasForm),
      phone: Boolean(probe?.hasTelLink),
      whatsapp: Boolean(probe?.hasWhatsAppLink),
      email: Boolean(probe?.hasMailto),
    },
    images: { total: probe?.imgCount ?? null, withAlt: probe?.imgWithAlt ?? null },
    gbp,
  };

  return { sections, metrics, overallScore };
}
