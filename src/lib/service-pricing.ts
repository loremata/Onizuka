import type { DigitalAuditSectionKey } from "@prisma/client";

/**
 * Catalogo servizi + prezzi indicativi Online Station (range mercato IT per PMI).
 * MODIFICA QUI i prezzi quando vuoi: vengono usati per la colonna "Prezzo primario"
 * scritta sul Google Sheet e per la pipeline commerciale.
 */
export const SECTION_SERVICE_PRICING: Record<
  DigitalAuditSectionKey,
  { service: string; price: string }
> = {
  WEBSITE: { service: "Sito web professionale", price: "da € 1.500" },
  UX: { service: "Restyling / UX sito", price: "da € 900" },
  SEO: { service: "SEO / posizionamento", price: "€ 450–900 / mese" },
  LOCAL: { service: "Local SEO / Google Maps", price: "€ 300–500 / mese" },
  REVIEWS: { service: "Gestione recensioni", price: "€ 200–400 / mese" },
  SOCIAL: { service: "Social media management", price: "€ 490–1.200 / mese" },
  ADV: { service: "Campagne Ads (gestione)", price: "€ 400–800 / mese + budget" },
  CONVERSION: { service: "Ottimizzazione conversioni", price: "da € 700" },
  TRACKING: { service: "Setup analytics / tracking", price: "da € 490" },
  BRAND: { service: "Brand & posizionamento", price: "da € 990" },
};

export type AuditCommercialOutcome = {
  primaryService: string;
  primaryPrice: string;
  secondaryServices: string[];
};

/**
 * Dalle sezioni audit (più deboli prima) ricava il servizio primario da vendere
 * + fino a 2 servizi secondari (distinti) per il cross-sell.
 */
export function buildAuditCommercialOutcome(
  sections: { sectionKey: DigitalAuditSectionKey; score: number }[]
): AuditCommercialOutcome {
  const ranked = [...sections].sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const picks: { service: string; price: string }[] = [];
  for (const s of ranked) {
    const p = SECTION_SERVICE_PRICING[s.sectionKey];
    if (p && !seen.has(p.service)) {
      seen.add(p.service);
      picks.push(p);
    }
    if (picks.length >= 3) break;
  }
  const primary = picks[0] ?? { service: "Consulenza digitale", price: "su misura" };
  return {
    primaryService: primary.service,
    primaryPrice: primary.price,
    secondaryServices: picks.slice(1, 3).map((p) => p.service),
  };
}
