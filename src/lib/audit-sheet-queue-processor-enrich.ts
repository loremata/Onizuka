import { prisma } from "@/lib/prisma";
import { buildAuditOutreachKit } from "@/lib/audit-outreach-kit";
import { ensureDigitalAuditPublicReportToken } from "@/lib/public-report-token";

export async function enrichAuditOutreach(auditId: string): Promise<void> {
  const audit = await prisma.digitalAudit.findUnique({
    where: { id: auditId },
    include: {
      sections: true,
      recommendedBrand: { select: { name: true } },
      recommendedService: { select: { name: true } },
      client: { select: { companyName: true } },
    },
  });
  if (!audit) return;

  const kit = buildAuditOutreachKit({
    businessName: audit.businessName ?? audit.client?.companyName ?? "Azienda",
    overallScore: audit.overallScore,
    priorityProblem: audit.priorityProblem,
    brandName: audit.recommendedBrand?.name,
    serviceName: audit.recommendedService?.name,
    sections: audit.sections,
  });

  await prisma.digitalAudit.update({
    where: { id: auditId },
    data: {
      outreachLinkedInBody: kit.linkedInBody,
      outreachCallScript: kit.callScript,
    },
  });

  await ensureDigitalAuditPublicReportToken(auditId, audit.ownerUserId).catch(() => undefined);
}
