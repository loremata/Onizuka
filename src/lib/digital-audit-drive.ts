import type { DigitalAuditSectionKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auditPdfFilename, buildAuditPdfBuffer } from "@/lib/audit-pdf";
import type { AuditMetrics } from "@/lib/audit/scoring";
import {
  AUDIT_DRIVE_SUBFOLDER,
  ensureClientDriveStructure,
} from "@/lib/client-drive-structure";
import {
  createDriveSubfolder,
  extractDriveFolderIdFromUrl,
  isGoogleDriveServiceAccountConfigured,
  uploadDriveFile,
} from "@/lib/google-drive-service";

export { AUDIT_DRIVE_SUBFOLDER };

async function ensureClientDriveRoot(clientId: string): Promise<string | null> {
  const result = await ensureClientDriveStructure(clientId);
  return result?.rootFolderId ?? null;
}

export async function uploadDigitalAuditReportsToDrive(auditId: string): Promise<{
  internalReportDriveUrl: string | null;
  clientReportDriveUrl: string | null;
}> {
  if (!isGoogleDriveServiceAccountConfigured()) {
    return { internalReportDriveUrl: null, clientReportDriveUrl: null };
  }

  const audit = await prisma.digitalAudit.findUnique({
    where: { id: auditId },
    include: {
      sections: true,
      recommendedBrand: { select: { name: true } },
      recommendedService: { select: { name: true } },
      client: { select: { id: true, companyName: true, driveFolderUrl: true } },
    },
  });

  if (!audit || !audit.clientId || audit.overallScore == null) {
    return { internalReportDriveUrl: null, clientReportDriveUrl: null };
  }

  const rootId = await ensureClientDriveRoot(audit.clientId);
  if (!rootId) return { internalReportDriveUrl: null, clientReportDriveUrl: null };

  const auditFolder = await createDriveSubfolder(rootId, AUDIT_DRIVE_SUBFOLDER);
  if (!auditFolder) return { internalReportDriveUrl: null, clientReportDriveUrl: null };

  let metrics: AuditMetrics | null = null;
  try {
    metrics = audit.metricsJson ? (JSON.parse(audit.metricsJson) as AuditMetrics) : null;
  } catch {
    metrics = null;
  }

  const pdfInput = {
    businessName: audit.businessName ?? "Cliente",
    vatNumber: audit.vatNumber,
    website: audit.website,
    overallScore: audit.overallScore,
    priorityProblem: audit.priorityProblem,
    brandName: audit.recommendedBrand?.name ?? null,
    serviceName: audit.recommendedService?.name ?? null,
    sections: audit.sections.map((s) => ({
      sectionKey: s.sectionKey as DigitalAuditSectionKey,
      score: s.score,
      positives: s.positives,
      issues: s.issues,
    })),
    metrics,
    auditId: audit.id,
  };

  const [internalBuf, clientBuf] = await Promise.all([
    buildAuditPdfBuffer({ ...pdfInput, variant: "internal" }),
    buildAuditPdfBuffer({ ...pdfInput, variant: "client" }),
  ]);

  const baseName = audit.businessName ?? "cliente";
  const [internalFile, clientFile] = await Promise.all([
    uploadDriveFile({
      parentFolderId: auditFolder.folderId,
      filename: auditPdfFilename(baseName, audit.id, "internal"),
      mimeType: "application/pdf",
      buffer: internalBuf,
    }),
    uploadDriveFile({
      parentFolderId: auditFolder.folderId,
      filename: auditPdfFilename(baseName, audit.id, "client"),
      mimeType: "application/pdf",
      buffer: clientBuf,
    }),
  ]);

  const internalReportDriveUrl = internalFile?.webViewLink ?? null;
  const clientReportDriveUrl = clientFile?.webViewLink ?? null;

  if (internalReportDriveUrl || clientReportDriveUrl) {
    await prisma.digitalAudit.update({
      where: { id: auditId },
      data: { internalReportDriveUrl, clientReportDriveUrl },
    });
  }

  return { internalReportDriveUrl, clientReportDriveUrl };
}
