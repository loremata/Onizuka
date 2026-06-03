import type { Client, DigitalAuditSectionKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seedCommercialCatalog } from "@/lib/commercial-catalog-seed";
import { notifyDigitalAuditCompleted } from "@/lib/audit-telegram-notify";
import { uploadDigitalAuditReportsToDrive } from "@/lib/digital-audit-drive";
import { pickAuditRecommendationFromSections, buildAuditFindings } from "@/lib/audit-service-recommendations";
import { wireAuditCommercialCrm } from "@/lib/audit-commercial-wire";
import type { AuditMatchKind } from "@/lib/audit-commercial-match";
import { buildFirstAuditOutreachEmail } from "@/lib/audit-outreach-draft";
import { createAuditOutreachSequence } from "@/lib/outreach-sequence";
import { ensureClientDriveStructure } from "@/lib/client-drive-structure";
import { applyGbpEnrichmentToSections } from "@/lib/digital-audit-gbp-enrich";
import { resolveGbpAuditSignals, type AssetGbpHint } from "@/lib/gbp-audit-signals";
import { applyWebsiteProbeToSections, probeWebsiteWithSubpages } from "@/lib/website-probe";
import { buildAuditOutreachKit } from "@/lib/audit-outreach-kit";
import { ensureDigitalAuditPublicReportToken } from "@/lib/public-report-token";

export type SectionAnalysis = {
  sectionKey: DigitalAuditSectionKey;
  score: number;
  positives: string;
  issues: string;
};

const SECTION_KEYS: DigitalAuditSectionKey[] = [
  "WEBSITE",
  "SEO",
  "LOCAL",
  "REVIEWS",
  "SOCIAL",
  "ADV",
  "UX",
  "CONVERSION",
  "TRACKING",
  "BRAND",
];

type ClientSnapshot = Client & {
  _count: { assets: number; contacts: number; posts: number };
  assets: AssetGbpHint[];
  commercialServices: { active: boolean; commercialService: { slug: string; name: string } }[];
};

function analyzeSections(client: ClientSnapshot, siteHasMapsLink = false): SectionAnalysis[] {
  const hasWebsite = Boolean(client.website?.trim());
  const assetCount = client._count.assets;
  const hasSocial = client.commercialServices.some(
    (cs) => cs.active && ["social-mgmt", "meta-ads"].includes(cs.commercialService.slug)
  );
  const hasSeo = client.commercialServices.some((cs) => cs.active && cs.commercialService.slug === "seo");
  const hasAds =
    client.commercialServices.some((cs) => cs.active && ["google-ads", "meta-ads"].includes(cs.commercialService.slug));
  const gbp = resolveGbpAuditSignals(client.assets, siteHasMapsLink);
  const hasGbpAsset = gbp.hasGbpAsset;
  const hasStrongGbp = gbp.hasStrongGbp;
  const hasLocalSignals =
    Boolean(client.city?.trim()) &&
    Boolean(client.address?.trim()) &&
    Boolean(client.phone?.trim());

  const websiteScore = hasWebsite ? 62 : 28;
  const seoScore = hasSeo ? 70 : hasWebsite ? 45 : 25;
  const localScore = hasStrongGbp
    ? 78
    : hasGbpAsset
    ? 72
    : hasLocalSignals
      ? 62
      : client.city && client.address
        ? 55
        : client.city
          ? 48
          : 32;
  const reviewsScore = hasStrongGbp ? 58 : hasGbpAsset ? 52 : 40;
  const socialScore = assetCount >= 2 || hasSocial ? 58 : assetCount === 1 ? 42 : 25;
  const advScore = hasAds ? 65 : 30;
  const uxScore = hasWebsite ? 50 : 22;
  const conversionScore = hasWebsite && hasSeo ? 52 : hasWebsite ? 38 : 20;
  const trackingScore = hasWebsite ? 35 : 18;
  const brandScore = client.notes?.trim() || assetCount > 0 ? 48 : 30;

  const scores: Record<DigitalAuditSectionKey, number> = {
    WEBSITE: websiteScore,
    SEO: seoScore,
    LOCAL: localScore,
    REVIEWS: reviewsScore,
    SOCIAL: socialScore,
    ADV: advScore,
    UX: uxScore,
    CONVERSION: conversionScore,
    TRACKING: trackingScore,
    BRAND: brandScore,
  };

  const messages: Record<DigitalAuditSectionKey, { pos: string; issue: string }> = {
    WEBSITE: {
      pos: hasWebsite ? "Sito web indicato in anagrafica." : "",
      issue: hasWebsite ? "Verificare mobile, velocità e CTA." : "Nessun sito registrato: gap prioritario.",
    },
    SEO: {
      pos: hasSeo ? "Servizio SEO attivo sul cliente." : "",
      issue: hasSeo ? "Monitorare keyword e contenuti." : "SEO non tracciata come servizio attivo.",
    },
    LOCAL: {
      pos: [
        hasStrongGbp
          ? "GBP collegato con URL profilo o link Maps sul sito."
          : hasGbpAsset
            ? "Asset Google Business Profile collegato in anagrafica."
            : "",
        hasLocalSignals ? "Anagrafica completa (indirizzo, telefono, città)." : "",
        client.city && !hasLocalSignals ? `Presenza locale: ${client.city}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      issue: hasStrongGbp
        ? "Ottimizzare categorie, orari, post e risposta recensioni su GBP."
        : hasGbpAsset
        ? "Aggiungere URL profilo GBP sull'asset e verificare NAP."
        : hasLocalSignals
          ? "Verificare coerenza NAP su directory e Google Maps."
          : "Google Business Profile da verificare o collegare come asset.",
    },
    REVIEWS: {
      pos: hasStrongGbp
        ? "Profilo GBP collegato: monitoraggio recensioni consigliato."
        : hasGbpAsset
          ? "Canale recensioni potenzialmente attivo via GBP."
          : "",
      issue: hasStrongGbp
        ? "Monitorare volume, valutazione media e tempi di risposta."
        : hasGbpAsset
        ? "Collegare URL profilo GBP per analisi recensioni (API in roadmap)."
        : "Recensioni online: analisi esterna non automatizzata in questo MVP.",
    },
    SOCIAL: {
      pos: assetCount > 0 ? `${assetCount} asset digitali collegati.` : "",
      issue: socialScore < 45 ? "Presenza social debole o assente." : "Ottimizzare coerenza tra canali.",
    },
    ADV: {
      pos: hasAds ? "Campagne ADV tracciate come attive." : "",
      issue: hasAds ? "Ottimizzare ROI campagne." : "Nessuna campagna ADV attiva registrata.",
    },
    UX: {
      pos: hasWebsite ? "Base sito presente per review UX." : "",
      issue: "Audit UX approfondito richiede crawl esterno (roadmap).",
    },
    CONVERSION: {
      pos: "",
      issue:
        conversionScore < 45
          ? "Percorso conversione probabilmente debole (landing/CTA/form)."
          : "Mantenere test A/B e lead magnet.",
    },
    TRACKING: {
      pos: "",
      issue: "Pixel/analytics da verificare su property reale.",
    },
    BRAND: {
      pos: client.notes?.trim() ? "Note brand in scheda cliente." : "",
      issue: "Coerenza visiva e messaggio da allineare tra touchpoint.",
    },
  };

  return SECTION_KEYS.map((sectionKey) => ({
    sectionKey,
    score: scores[sectionKey],
    positives: messages[sectionKey].pos,
    issues: messages[sectionKey].issue,
  }));
}

export async function runDigitalAuditForClient(params: {
  ownerUserId: string;
  clientId: string;
  vatNumber?: string;
  leadId?: string;
  createOutreachDraft?: boolean;
  matchKind?: AuditMatchKind;
  matchWarnings?: string[];
  wireCommercialCrm?: boolean;
}): Promise<{ auditId: string; outreachDraftId?: string; opportunityId?: string; quoteId?: string }> {
  await seedCommercialCatalog();

  let leadId = params.leadId;
  let matchKind = params.matchKind;
  let matchWarnings = params.matchWarnings;

  if (!matchKind && params.clientId) {
    const { prepareAuditCommercialTarget } = await import("@/lib/audit-commercial-match");
    const target = await prepareAuditCommercialTarget({
      ownerUserId: params.ownerUserId,
      clientId: params.clientId,
      vatNumber: params.vatNumber,
      leadId,
      acquisitionSource: "client_button",
    });
    leadId = target.leadId ?? leadId;
    matchKind = target.matchKind;
    matchWarnings = target.warnings;
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    include: {
      _count: { select: { assets: true, contacts: true, posts: true } },
      assets: { select: { platform: true, profileUrl: true, notes: true } },
      commercialServices: {
        include: { commercialService: { select: { slug: true, name: true } } },
      },
    },
  });

  if (!client) throw new Error("Cliente non trovato");

  const probe = await probeWebsiteWithSubpages(client.website);
  const siteHasMapsLink = Boolean(probe?.hasGoogleMapsLink);
  let sections = analyzeSections(client, siteHasMapsLink);
  sections = applyWebsiteProbeToSections(sections, probe) as SectionAnalysis[];

  const gbpEnriched = await applyGbpEnrichmentToSections({
    clientId: client.id,
    businessName: client.companyName,
    city: client.city,
    sections,
  });
  sections = gbpEnriched.sections;

  const overallScore = Math.round(sections.reduce((s, x) => s + x.score, 0) / sections.length);
  const recPick = pickAuditRecommendationFromSections(sections);
  const rec = {
    priorityProblem: recPick.priorityProblem,
    brandSlug: recPick.brandSlug,
    serviceSlug: recPick.serviceSlug,
  };
  const weakest = [...sections].sort((a, b) => a.score - b.score)[0];
  const probeNote = probe
    ? `Probe HTTP: ${probe.ok ? "OK" : "fail"} ${probe.statusCode ?? ""} ${probe.responseMs ?? ""}ms${probe.title ? ` · ${probe.title.slice(0, 60)}` : ""}${probe.subpagesProbed > 0 ? ` · sottopagine ${probe.subpagesOk}/${probe.subpagesProbed}` : ""}.`
    : "Nessun sito in anagrafica.";

  const [brand, service] = await Promise.all([
    prisma.ecosystemBrand.findUnique({ where: { slug: rec.brandSlug } }),
    prisma.commercialService.findUnique({ where: { slug: rec.serviceSlug } }),
  ]);

  const gbpNote = gbpEnriched.gbp?.gbpPlaceName
    ? ` GBP: ${gbpEnriched.gbp.gbpPlaceName}${gbpEnriched.gbp.gbpRating != null ? ` ${gbpEnriched.gbp.gbpRating}/5` : ""}${gbpEnriched.gbp.gbpReviewCount != null ? ` (${gbpEnriched.gbp.gbpReviewCount} rec.)` : ""}.`
    : "";

  const audit = await prisma.digitalAudit.create({
    data: {
      ownerUserId: params.ownerUserId,
      clientId: client.id,
      leadId,
      vatNumber: params.vatNumber?.trim() || client.vatNumber,
      businessName: client.companyName,
      website: client.website,
      status: "COMPLETED",
      overallScore,
      priorityProblem: rec.priorityProblem,
      recommendedBrandId: brand?.id,
      recommendedServiceId: service?.id,
      gbpRating: gbpEnriched.gbp?.gbpRating ?? undefined,
      gbpReviewCount: gbpEnriched.gbp?.gbpReviewCount ?? undefined,
      gbpPlaceName: gbpEnriched.gbp?.gbpPlaceName ?? undefined,
      internalNotes: `Audit automatico. Sezione più debole: ${weakest?.sectionKey ?? "—"}. ${probeNote}${gbpNote}`,
      sections: {
        create: sections.map((s) => ({
          sectionKey: s.sectionKey,
          score: s.score,
          positives: s.positives || null,
          issues: s.issues || null,
        })),
      },
    },
  });

  let outreachDraftId: string | undefined;
  if (params.createOutreachDraft) {
    const emailDraft = buildFirstAuditOutreachEmail({
      companyName: client.companyName,
      priorityProblem: rec.priorityProblem,
      brandSlug: brand?.slug,
      brandName: brand?.name,
      serviceName: service?.name,
      overallScore,
      findings: buildAuditFindings(sections),
    });
    const draft = await prisma.outreachDraft.create({
      data: {
        ownerUserId: params.ownerUserId,
        clientId: client.id,
        leadId,
        digitalAuditId: audit.id,
        subject: emailDraft.subject,
        body: emailDraft.body,
        status: "PENDING_APPROVAL",
      },
    });
    outreachDraftId = draft.id;

    await createAuditOutreachSequence({
      ownerUserId: params.ownerUserId,
      clientId: client.id,
      digitalAuditId: audit.id,
      companyName: client.companyName,
      firstDraftId: draft.id,
      firstSubject: draft.subject,
      firstBody: draft.body,
      priorityProblem: rec.priorityProblem,
    }).catch(() => undefined);
  }

  await ensureClientDriveStructure(client.id).catch(() => null);

  const driveUrls = await uploadDigitalAuditReportsToDrive(audit.id).catch(() => ({
    internalReportDriveUrl: null,
    clientReportDriveUrl: null,
  }));

  let opportunityId: string | undefined;
  let quoteId: string | undefined;
  if (params.wireCommercialCrm !== false) {
    const wired = await wireAuditCommercialCrm({
      ownerUserId: params.ownerUserId,
      clientId: client.id,
      auditId: audit.id,
      leadId,
      clientName: client.companyName,
      overallScore,
      priorityProblem: rec.priorityProblem,
      recommendedOffer:
        brand?.name && service?.name ? `${brand.name} — ${service.name}` : service?.name ?? brand?.name,
      outreachDraftId,
      matchKind,
      matchWarnings,
    }).catch(() => ({ taskIds: [] as string[], opportunityId: undefined, quoteId: undefined }));
    opportunityId = wired?.opportunityId;
    quoteId = wired?.quoteId;
  }

  await notifyDigitalAuditCompleted({
    businessName: client.companyName,
    overallScore,
    priorityProblem: rec.priorityProblem,
    brandName: brand?.name ?? null,
    serviceName: service?.name ?? null,
    auditId: audit.id,
    outreachDraftId,
    internalReportDriveUrl: driveUrls.internalReportDriveUrl,
    clientReportDriveUrl: driveUrls.clientReportDriveUrl,
  }).catch(() => undefined);

  const kit = buildAuditOutreachKit({
    businessName: client.companyName,
    overallScore,
    priorityProblem: rec.priorityProblem,
    brandName: brand?.name,
    serviceName: service?.name,
    sections,
  });
  await prisma.digitalAudit.update({
    where: { id: audit.id },
    data: {
      outreachLinkedInBody: kit.linkedInBody,
      outreachCallScript: kit.callScript,
    },
  });
  await ensureDigitalAuditPublicReportToken(audit.id, params.ownerUserId).catch(() => undefined);

  return { auditId: audit.id, outreachDraftId, opportunityId, quoteId };
}

export async function runDigitalAuditByVat(params: {
  ownerUserId: string;
  vatNumber: string;
  website?: string | null;
  businessName?: string | null;
  createOutreachDraft?: boolean;
}): Promise<{ auditId: string; clientId: string; leadId?: string; outreachDraftId?: string }> {
  const { runDigitalAuditUnified } = await import("@/lib/audit-commercial-entry");
  const result = await runDigitalAuditUnified({
    ownerUserId: params.ownerUserId,
    vatNumber: params.vatNumber,
    website: params.website,
    businessName: params.businessName,
    acquisitionSource: "vat_form",
    createOutreachDraft: params.createOutreachDraft,
  });
  return {
    auditId: result.auditId,
    clientId: result.clientId,
    leadId: result.leadId,
    outreachDraftId: result.outreachDraftId,
  };
}
