import type { CommercialProspectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { inferClientKind, normalizeVatNumber } from "@/lib/client-kind";
import { runDigitalAuditForClient } from "@/lib/digital-audit-run";
import { prepareAuditCommercialTarget } from "@/lib/audit-commercial-match";
import { logAdminAction } from "@/lib/admin-audit-log";
import { findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";

export type ProspectVatPipelineResult = {
  clientId: string;
  leadId: string;
  auditId: string;
  outreachDraftId?: string;
  quoteId?: string;
  stage: CommercialProspectStage;
  approvalsHref: string;
};

export {
  extractVatFromProspectCommand,
  isProspectVatCommand,
} from "@/lib/prospect-vat-command";

async function uniqueSlug(base: string): Promise<string> {
  let finalSlug = slugify(base) || "prospect";
  let attempt = 0;
  while (true) {
    const existing = await prisma.client.findUnique({ where: { slug: finalSlug } });
    if (!existing) return finalSlug;
    attempt += 1;
    finalSlug = `${slugify(base) || "prospect"}-${attempt}`;
  }
}

/** Crea o aggiorna scheda azienda da P.IVA (senza audit). */
export async function ensureBusinessClientByVat(params: {
  vatNumber: string;
  macroCategory?: "DIGITAL_AI" | "RETAIL_STORE" | "MIXED";
}): Promise<{ clientId: string; created: boolean }> {
  const vat = normalizeVatNumber(params.vatNumber);
  if (!vat || vat.length < 9) throw new Error("P.IVA non valida.");

  const existing = await findClientByFiscalIdentity({ vatNumber: vat });

  if (existing) {
    await prisma.client.update({
      where: { id: existing.id },
      data: {
        kind: "BUSINESS",
        clientMacroCategory: params.macroCategory ?? "DIGITAL_AI",
      },
    });
    return { clientId: existing.id, created: false };
  }

  const slug = await uniqueSlug(`piva-${vat}`);
  const client = await prisma.client.create({
    data: {
      companyName: `Prospect P.IVA ${vat}`,
      slug,
      contactEmail: `prospect+${vat}@onizuka.local`,
      status: "LEAD_QUALIFIED",
      vatNumber: vat,
      kind: "BUSINESS",
      clientMacroCategory: params.macroCategory ?? "DIGITAL_AI",
    },
  });
  return { clientId: client.id, created: true };
}

/** Workflow end-to-end: prospect digitale/AI da P.IVA (checklist §18.5). */
export async function runProspectDigitalAiByVat(params: {
  ownerUserId: string;
  vatNumber: string;
  commandLabel?: string;
}): Promise<ProspectVatPipelineResult> {
  const vat = normalizeVatNumber(params.vatNumber);
  if (!vat || vat.length < 9) throw new Error("P.IVA non valida.");

  const target = await prepareAuditCommercialTarget({
    ownerUserId: params.ownerUserId,
    vatNumber: vat,
    acquisitionSource: "prospect_pipeline",
  });

  let client = await prisma.client.findUniqueOrThrow({ where: { id: target.clientId } });
  if (target.createdClient) {
    client = await prisma.client.update({
      where: { id: client.id },
      data: {
        notes: params.commandLabel
          ? `Creato da comando Onizuka: ${params.commandLabel}`
          : "Prospect digitale/AI da P.IVA",
      },
    });
    void logAdminAction({
      actorUserId: params.ownerUserId,
      action: "client.create",
      summary: `Prospect creato da P.IVA ${vat}`,
      entityType: "client",
      entityId: client.id,
      metadata: { source: "prospect_vat_pipeline", vat },
    });
  } else {
    client = await prisma.client.update({
      where: { id: client.id },
      data: {
        kind: inferClientKind({ vatNumber: client.vatNumber, fiscalCode: client.fiscalCode, explicit: "BUSINESS" }),
        clientMacroCategory: client.clientMacroCategory ?? "DIGITAL_AI",
        status: client.status === "ACTIVE_CLIENT" ? client.status : "LEAD_QUALIFIED",
      },
    });
  }

  const leadId = target.leadId;
  if (!leadId) throw new Error("Lead non risolto dalla pipeline audit.");

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { commercialProspectStage: "AUDIT_IN_PROGRESS" },
  });

  const auditResult = await runDigitalAuditForClient({
    ownerUserId: params.ownerUserId,
    clientId: client.id,
    vatNumber: vat,
    leadId: lead.id,
    createOutreachDraft: true,
    matchKind: target.matchKind,
    matchWarnings: target.warnings,
  });

  if (auditResult.outreachDraftId) {
    await prisma.outreachDraft.update({
      where: { id: auditResult.outreachDraftId },
      data: { leadId: lead.id },
    });
  }

  const followUpAt = new Date();
  followUpAt.setDate(followUpAt.getDate() + 7);
  await prisma.leadFollowup.create({
    data: {
      leadId: lead.id,
      type: "audit_followup_7d",
      scheduledAt: followUpAt,
      notes: "Follow-up automatico post audit P.IVA (PUNTO-SITUA §13)",
    },
  });

  const stage: CommercialProspectStage =
    auditResult.outreachDraftId || auditResult.opportunityId
      ? "AWAITING_SEND_APPROVAL"
      : "REPORT_GENERATED";

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      commercialProspectStage: stage,
      notes: [
        lead.notes?.trim(),
        `Audit ${auditResult.auditId} · ${new Date().toISOString().slice(0, 10)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  });

  void logAdminAction({
    actorUserId: params.ownerUserId,
    action: "prospect.vat_pipeline",
    summary: `Pipeline prospect P.IVA ${vat} completata (audit ${auditResult.auditId})`,
    entityType: "client",
    entityId: client.id,
    metadata: {
      vat,
      auditId: auditResult.auditId,
      leadId: lead.id,
      stage,
      opportunityId: auditResult.opportunityId,
    },
  });

  return {
    clientId: client.id,
    leadId: lead.id,
    auditId: auditResult.auditId,
    outreachDraftId: auditResult.outreachDraftId,
    quoteId: auditResult.quoteId,
    stage,
    approvalsHref: "/admin/approvals",
  };
}
