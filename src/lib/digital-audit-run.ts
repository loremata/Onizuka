import type { DigitalAuditSectionKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCommercialCatalogSeeded } from "@/lib/commercial-catalog-seed";
import { notifyDigitalAuditCompleted } from "@/lib/audit-telegram-notify";
import { uploadDigitalAuditReportsToDrive } from "@/lib/digital-audit-drive";
import { pickAuditRecommendationFromSections, buildAuditFindings } from "@/lib/audit-service-recommendations";
import { wireAuditCommercialCrm } from "@/lib/audit-commercial-wire";
import type { AuditMatchKind } from "@/lib/audit-commercial-match";
import { buildFirstAuditOutreachEmail } from "@/lib/audit-outreach-draft";
import { createAuditOutreachSequence } from "@/lib/outreach-sequence";
import { ensureClientDriveStructure } from "@/lib/client-drive-structure";
import { fetchGbpSnapshot } from "@/lib/digital-audit-gbp-enrich";
import { probeWebsiteWithSubpages } from "@/lib/website-probe";
import { buildAuditOutreachKit } from "@/lib/audit-outreach-kit";
import { ensureDigitalAuditPublicReportToken } from "@/lib/public-report-token";
import { fetchPageSpeed } from "@/lib/audit/pagespeed";
import { scoreAudit } from "@/lib/audit/scoring";

export type SectionAnalysis = {
  sectionKey: DigitalAuditSectionKey;
  score: number;
  positives: string;
  issues: string;
};

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
  await ensureCommercialCatalogSeeded();

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

  const hasWebsiteUrl = Boolean(client.website?.trim());
  const probe = await probeWebsiteWithSubpages(client.website);

  // Recupero email dal sito (mailto/pagina contatti): i lead scrapati non hanno email
  // dal registro/Places, quindi le bozze non sarebbero inviabili. Se il contatto è vuoto
  // o segnaposto @onizuka.local e il sito espone un'email valida, la salvo sul cliente.
  const currentEmail = client.contactEmail?.trim() ?? "";
  const emailIsPlaceholder = !currentEmail || /@onizuka\.local$/i.test(currentEmail);
  if (probe?.email && emailIsPlaceholder) {
    await prisma.client
      .update({ where: { id: client.id }, data: { contactEmail: probe.email } })
      .catch(() => undefined);
    client.contactEmail = probe.email;
    if (leadId) {
      await prisma.lead
        .updateMany({ where: { id: leadId, OR: [{ email: null }, { email: "" }] }, data: { email: probe.email } })
        .catch(() => undefined);
    }
  }
  // PageSpeed solo se il sito risponde (niente chiamate lente/inutili su siti giù o assenti).
  const psi = hasWebsiteUrl && probe?.ok && client.website ? await fetchPageSpeed(client.website) : null;
  const gbpSnapshot = await fetchGbpSnapshot({
    clientId: client.id,
    businessName: client.companyName,
    city: client.city,
  });

  const scored = scoreAudit({
    hasWebsite: hasWebsiteUrl,
    probe,
    psi,
    gbp: {
      hasGbp: gbpSnapshot != null,
      rating: gbpSnapshot?.gbpRating ?? null,
      reviewCount: gbpSnapshot?.gbpReviewCount ?? null,
      categories: gbpSnapshot?.gbpCategories ?? [],
      hasHours: gbpSnapshot?.gbpHasHours ?? false,
      photoCount: gbpSnapshot?.gbpPhotoCount ?? 0,
    },
    city: client.city,
  });
  const sections = scored.sections;
  const overallScore = scored.overallScore;
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

  const gbpNote = gbpSnapshot?.gbpPlaceName
    ? ` GBP: ${gbpSnapshot.gbpPlaceName}${gbpSnapshot.gbpRating != null ? ` ${gbpSnapshot.gbpRating}/5` : ""}${gbpSnapshot.gbpReviewCount != null ? ` (${gbpSnapshot.gbpReviewCount} rec.)` : ""}.`
    : "";

  // Un solo audit per azienda: create del nuovo + delete dei precedenti dello stesso
  // cliente in UNA transazione atomica → niente audit duplicati se un crash o un
  // re-audit concorrente cade tra le due operazioni. (sezioni in cascade-delete;
  // bozze/sequenze outreach restano con riferimento azzerato.)
  const audit = await prisma.$transaction(async (tx) => {
    const created = await tx.digitalAudit.create({
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
        gbpRating: gbpSnapshot?.gbpRating ?? undefined,
        gbpReviewCount: gbpSnapshot?.gbpReviewCount ?? undefined,
        gbpPlaceName: gbpSnapshot?.gbpPlaceName ?? undefined,
        metricsJson: JSON.stringify(scored.metrics),
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

    await tx.digitalAudit.deleteMany({
      where: { ownerUserId: params.ownerUserId, clientId: client.id, id: { not: created.id } },
    });

    return created;
  });

  // Sicurezza: non creare outreach a freddo verso chi è già cliente reale.
  // L'audit resta utile (refresh interno), ma niente prima mail/sequenza.
  const skipOutreachExistingClient =
    params.createOutreachDraft && client.relationshipState === "CLIENTE";
  if (skipOutreachExistingClient) {
    await prisma.digitalAudit
      .update({
        where: { id: audit.id },
        data: { internalNotes: `${audit.internalNotes ?? ""} · Outreach saltato: già cliente.`.slice(0, 1000) },
      })
      .catch(() => undefined);
  }

  let outreachDraftId: string | undefined;
  if (params.createOutreachDraft && !skipOutreachExistingClient) {
    // Re-audit: chiudi le sequenze ancora attive/in pausa dello stesso cliente,
    // così non restano due sequenze parallele a mandare doppi follow-up.
    await prisma.outreachSequence
      .updateMany({
        where: { clientId: client.id, status: { in: ["ACTIVE", "PAUSED"] } },
        data: { status: "CANCELLED" },
      })
      .catch(() => undefined);

    // Token report generato ORA (idempotente) per includere il link nella mail:
    // così il prospect vede l'analisi e il click viene tracciato automaticamente.
    const reportToken = await ensureDigitalAuditPublicReportToken(audit.id, params.ownerUserId)
      .then((r) => r.token)
      .catch(() => null);
    const reportBase = (process.env.NEXTAUTH_URL ?? "https://onizuka.it").replace(/\/$/, "");
    const reportUrl = reportToken ? `${reportBase}/report/${reportToken}` : undefined;

    const emailDraft = buildFirstAuditOutreachEmail({
      companyName: client.companyName,
      priorityProblem: rec.priorityProblem,
      brandSlug: brand?.slug,
      brandName: brand?.name,
      serviceName: service?.name,
      overallScore,
      findings: buildAuditFindings(sections),
      // Dati per la personalizzazione: aggancio "nessun sito" + recensioni Google reali.
      hasWebsite: Boolean(client.website?.trim()),
      gbpReviewCount: gbpSnapshot?.gbpReviewCount ?? null,
      gbpRating: gbpSnapshot?.gbpRating ?? null,
      reportUrl,
    });
    const draft = await prisma.outreachDraft.create({
      data: {
        ownerUserId: params.ownerUserId,
        clientId: client.id,
        leadId,
        digitalAuditId: audit.id,
        subject: emailDraft.subject,
        subjectAlt: emailDraft.subjectAlt ?? null,
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

  // Drive: i service account non hanno quota su "Il mio Drive" (Gmail personale) → 403 in upload.
  // I PDF audit restano su storage S3 (scaricabili dai pulsanti). Riattivabile con un Drive condiviso
  // (Google Workspace) impostando ONIZUKA_DRIVE_AUDIT_UPLOAD=1.
  const driveAuditEnabled = process.env.ONIZUKA_DRIVE_AUDIT_UPLOAD === "1";

  if (driveAuditEnabled) {
    await ensureClientDriveStructure(client.id).catch(() => null);
  }

  const driveUrls = driveAuditEnabled
    ? await uploadDigitalAuditReportsToDrive(audit.id).catch(() => ({
        internalReportDriveUrl: null,
        clientReportDriveUrl: null,
      }))
    : { internalReportDriveUrl: null, clientReportDriveUrl: null };

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
