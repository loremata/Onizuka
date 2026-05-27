import { prisma } from "@/lib/prisma";
import {
  DIGITAL_AI_SERVICE_SLUGS,
  RETAIL_STORE_SERVICE_SLUGS,
} from "@/lib/service-macro-category";

export type CrossSellQueryId =
  | "studiopop-without-ads"
  | "labseven-without-seo"
  | "website-no-maintenance"
  | "website-12-months"
  | "tim-fiber-without-tim-vision"
  | "mobile-without-fiber"
  | "retail-business-without-digital"
  | "digital-without-ai"
  | "social-without-website-refresh"
  | "ads-without-landing";

export type CrossSellQueryDef = {
  id: CrossSellQueryId;
  title: string;
  objective: string;
  brandHint?: string;
};

export const CROSS_SELL_QUERIES: CrossSellQueryDef[] = [
  {
    id: "studiopop-without-ads",
    title: "StudioPop con social senza DoctorLead Ads",
    objective: "Proporre campagne Meta / Google Ads",
    brandHint: "DoctorLead",
  },
  {
    id: "labseven-without-seo",
    title: "LabSeven con sito senza SEO attiva",
    objective: "Proporre pacchetto SEO",
    brandHint: "LabSeven",
  },
  {
    id: "website-no-maintenance",
    title: "Sito web senza manutenzione/rinnovo",
    objective: "Proporre manutenzione ricorrente",
    brandHint: "Sito24Ore",
  },
  {
    id: "website-12-months",
    title: "Sito acquistato circa 12 mesi fa",
    objective: "Rinnovo, SEO, upgrade o ads",
    brandHint: "LabSeven",
  },
  {
    id: "tim-fiber-without-tim-vision",
    title: "Fibra TIM senza TIM Vision",
    objective: "Proporre TV / streaming",
    brandHint: "Online Station",
  },
  {
    id: "mobile-without-fiber",
    title: "Mobile senza fibra",
    objective: "Proporre fibra / FWA",
    brandHint: "Online Station",
  },
  {
    id: "retail-business-without-digital",
    title: "Aziende negozio senza servizi digitali",
    objective: "Vendere sito, social, ads, AI",
    brandHint: "VaultAI",
  },
  {
    id: "digital-without-ai",
    title: "Clienti digitali senza AI/automazioni",
    objective: "Proporre VaultAI",
    brandHint: "VaultAI",
  },
  {
    id: "social-without-website-refresh",
    title: "Social attivo senza sito aggiornato",
    objective: "Proporre sito o restyling",
    brandHint: "LabSeven",
  },
  {
    id: "ads-without-landing",
    title: "Ads senza landing dedicata",
    objective: "Proporre landing DoctorLead",
    brandHint: "DoctorLead",
  },
];

type ClientHit = {
  clientId: string;
  companyName: string;
  detail: string;
};

async function loadActiveServiceSlugsByClient(
  clientIds: string[]
): Promise<Map<string, Set<string>>> {
  if (clientIds.length === 0) return new Map();
  const rows = await prisma.clientCommercialService.findMany({
    where: { clientId: { in: clientIds }, active: true },
    include: { commercialService: { select: { slug: true } } },
  });
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = map.get(r.clientId) ?? new Set<string>();
    set.add(r.commercialService.slug);
    map.set(r.clientId, set);
  }
  return map;
}

async function activeClients(limit = 200) {
  return prisma.client.findMany({
    where: { status: { in: ["ACTIVE_CLIENT", "DORMANT", "INTERESTED", "NEGOTIATION"] } },
    orderBy: { companyName: "asc" },
    take: limit,
    select: {
      id: true,
      companyName: true,
      kind: true,
      vatNumber: true,
      fiscalCode: true,
      clientMacroCategory: true,
      createdAt: true,
    },
  });
}

function hasSlug(slugs: Set<string>, slug: string): boolean {
  return slugs.has(slug);
}

function hasAnySlug(slugs: Set<string>, list: Iterable<string>): boolean {
  for (const s of Array.from(list)) {
    if (slugs.has(s)) return true;
  }
  return false;
}

/** Esegue una delle 10 query cross-sell predefinite (PUNTO-SITUA §12). */
export async function runCrossSellQuery(
  queryId: CrossSellQueryId,
  limit = 40
): Promise<ClientHit[]> {
  const clients = await activeClients(250);
  const slugMap = await loadActiveServiceSlugsByClient(clients.map((c) => c.id));
  const hits: ClientHit[] = [];

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const elevenMonthsAgo = new Date();
  elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

  for (const c of clients) {
    const slugs = slugMap.get(c.id) ?? new Set<string>();
    let match = false;
    let detail = "";

    switch (queryId) {
      case "studiopop-without-ads":
        match =
          hasSlug(slugs, "social-mgmt") &&
          !hasAnySlug(slugs, ["google-ads", "meta-ads"]);
        detail = "Social attivo, ads assenti";
        break;
      case "labseven-without-seo":
        match = hasSlug(slugs, "website") && !hasSlug(slugs, "seo");
        detail = "Sito senza SEO";
        break;
      case "website-no-maintenance":
        match = hasSlug(slugs, "website") && !hasSlug(slugs, "maintenance");
        detail = "Sito senza manutenzione";
        break;
      case "website-12-months": {
        const websiteSince = await prisma.clientCommercialService.findFirst({
          where: {
            clientId: c.id,
            active: true,
            commercialService: { slug: "website" },
            since: { lte: twelveMonthsAgo, gte: elevenMonthsAgo },
          },
          select: { since: true },
        });
        match = !!websiteSince;
        detail = "Sito attivo da ~12 mesi";
        break;
      }
      case "tim-fiber-without-tim-vision":
        match = hasSlug(slugs, "fiber") && !hasSlug(slugs, "tim-vision");
        detail = "Fibra senza TIM Vision";
        break;
      case "mobile-without-fiber":
        match = hasSlug(slugs, "mobile") && !hasAnySlug(slugs, ["fiber", "fwa"]);
        detail = "Mobile senza fibra/FWA";
        break;
      case "retail-business-without-digital": {
        const isBusiness = !!c.vatNumber?.trim();
        const hasRetail = hasAnySlug(slugs, RETAIL_STORE_SERVICE_SLUGS);
        const hasDigital = hasAnySlug(slugs, DIGITAL_AI_SERVICE_SLUGS);
        match =
          isBusiness &&
          (c.clientMacroCategory === "RETAIL_STORE" || hasRetail) &&
          !hasDigital;
        detail = "Negozio/utility senza digitale";
        break;
      }
      case "digital-without-ai":
        match =
          hasAnySlug(slugs, DIGITAL_AI_SERVICE_SLUGS) &&
          !hasAnySlug(slugs, ["automations", "ai-consulting"]);
        detail = "Digitale senza AI";
        break;
      case "social-without-website-refresh":
        match =
          hasSlug(slugs, "social-mgmt") &&
          (!hasSlug(slugs, "website") || !hasSlug(slugs, "maintenance"));
        detail = "Social senza sito/manutenzione";
        break;
      case "ads-without-landing":
        match =
          hasAnySlug(slugs, ["google-ads", "meta-ads"]) && !hasSlug(slugs, "landing-page");
        detail = "Ads senza landing";
        break;
      default:
        match = false;
    }

    if (match) {
      hits.push({ clientId: c.id, companyName: c.companyName, detail });
      if (hits.length >= limit) break;
    }
  }

  return hits;
}
