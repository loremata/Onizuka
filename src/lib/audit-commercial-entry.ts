import {
  prepareAuditCommercialTarget,
  type PrepareAuditCommercialTargetInput,
  type PrepareAuditCommercialTargetResult,
} from "@/lib/audit-commercial-match";
import { runDigitalAuditForClient } from "@/lib/digital-audit-run";
import { prisma } from "@/lib/prisma";

export type RunDigitalAuditUnifiedInput = PrepareAuditCommercialTargetInput & {
  createOutreachDraft?: boolean;
  /** Aggiorna anagrafica client dopo il matching (sheet queue, import). */
  enrichClient?: {
    businessName?: string | null;
    contactEmail?: string | null;
    website?: string | null;
    city?: string | null;
    phone?: string | null;
  };
};

export type RunDigitalAuditUnifiedResult = {
  auditId: string;
  clientId: string;
  leadId?: string;
  outreachDraftId?: string;
  opportunityId?: string;
  quoteId?: string;
  target: PrepareAuditCommercialTargetResult;
};

/**
 * Ingresso unificato audit: matching commerciale → audit → wire CRM.
 * Usare da sheet queue, form P.IVA, client button, Places (quando disponibile).
 */
export async function runDigitalAuditUnified(
  input: RunDigitalAuditUnifiedInput
): Promise<RunDigitalAuditUnifiedResult> {
  const target = await prepareAuditCommercialTarget(input);

  if (input.enrichClient) {
    const data: Record<string, string> = {};
    const e = input.enrichClient;
    if (e.businessName?.trim()) data.companyName = e.businessName.trim();
    if (e.contactEmail?.trim()) data.contactEmail = e.contactEmail.trim();
    if (e.website?.trim()) data.website = e.website.trim();
    if (e.city?.trim()) data.city = e.city.trim();
    if (e.phone?.trim()) data.phone = e.phone.trim();
    if (Object.keys(data).length > 0) {
      await prisma.client.update({ where: { id: target.clientId }, data });
    }
  }

  if (input.leadId && target.leadId && input.googlePlaceId) {
    await prisma.lead
      .update({
        where: { id: target.leadId },
        data: {
          googlePlaceId: input.googlePlaceId,
          ...(input.website ? { website: input.website } : {}),
          ...(input.city ? { city: input.city } : {}),
          ...(input.businessName ? { businessName: input.businessName } : {}),
        },
      })
      .catch(() => undefined);
  }

  const audit = await runDigitalAuditForClient({
    ownerUserId: input.ownerUserId,
    clientId: target.clientId,
    vatNumber: input.vatNumber ?? undefined,
    leadId: target.leadId,
    createOutreachDraft: input.createOutreachDraft,
    matchKind: target.matchKind,
    matchWarnings: target.warnings,
  });

  return {
    auditId: audit.auditId,
    clientId: target.clientId,
    leadId: target.leadId,
    outreachDraftId: audit.outreachDraftId,
    opportunityId: audit.opportunityId,
    quoteId: audit.quoteId,
    target,
  };
}
