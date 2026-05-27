import type { AuditSheetQueueItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeWebsiteDomain } from "@/lib/audit-commercial-match";
import { runDigitalAuditUnified } from "@/lib/audit-commercial-entry";
import { enrichAuditOutreach } from "@/lib/audit-sheet-queue-processor-enrich";

async function findLeadByDomain(ownerUserId: string, domain: string) {
  return prisma.lead.findFirst({
    where: {
      ownerUserId,
      OR: [
        { website: { contains: domain, mode: "insensitive" } },
        { notes: { contains: domain, mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      vatNumber: true,
      businessName: true,
      convertedClientId: true,
    },
  });
}

async function findClientByWebsite(domain: string) {
  return prisma.client.findFirst({
    where: { website: { contains: domain, mode: "insensitive" } },
    select: { id: true, companyName: true, vatNumber: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function hasSheetProspectTask(ownerUserId: string, titlePart: string): Promise<boolean> {
  const existing = await prisma.flowTask.findFirst({
    where: {
      ownerUserId,
      source: "sheet_queue",
      status: { not: "DONE" },
      title: { contains: titlePart, mode: "insensitive" },
    },
  });
  return Boolean(existing);
}

export async function ensureSheetFiscalCompletionTask(params: {
  ownerUserId: string;
  label: string;
  leadId?: string;
  domain?: string;
}): Promise<string | undefined> {
  const titlePart = params.domain ?? params.leadId ?? params.label;
  if (await hasSheetProspectTask(params.ownerUserId, "Completare P.IVA")) {
    return undefined;
  }
  const task = await prisma.flowTask.create({
    data: {
      ownerUserId: params.ownerUserId,
      title: `Completare P.IVA — ${params.label}`,
      description: [
        params.domain ? `Dominio sheet: ${params.domain}` : null,
        params.leadId ? `Lead: /admin/crm/leads/${params.leadId}/edit` : null,
        "Completare partita IVA prima di eseguire audit digitale completo.",
      ]
        .filter(Boolean)
        .join("\n"),
      status: "TODO",
      priority: "MEDIUM",
      source: "sheet_queue",
    },
  });
  return task.id;
}

export async function ensureSheetProspectDataTask(params: {
  ownerUserId: string;
  label: string;
  leadId?: string;
}): Promise<string | undefined> {
  if (await hasSheetProspectTask(params.ownerUserId, "Completare dati prospect")) {
    return undefined;
  }
  const task = await prisma.flowTask.create({
    data: {
      ownerUserId: params.ownerUserId,
      title: `Completare dati prospect — ${params.label}`,
      description: [
        params.leadId ? `Lead: /admin/crm/leads/${params.leadId}/edit` : null,
        "Riga sheet con ragione sociale e città ma senza P.IVA/dominio: verifica manuale.",
      ]
        .filter(Boolean)
        .join("\n"),
      status: "TODO",
      priority: "MEDIUM",
      source: "sheet_queue",
    },
  });
  return task.id;
}

export type ProcessNonVatSheetRowResult = {
  status: "DONE" | "SKIPPED" | "FAILED";
  auditId?: string;
  clientId?: string;
  leadId?: string;
  errorDetail?: string;
};

/**
 * Righe sheet senza P.IVA: dominio o nome+città. Non crea client acquisito se prospect nuovo.
 */
export async function processNonVatSheetQueueItem(
  item: Pick<
    AuditSheetQueueItem,
    "id" | "ownerUserId" | "website" | "businessName" | "city" | "contactEmail"
  >
): Promise<ProcessNonVatSheetRowResult> {
  const domain = normalizeWebsiteDomain(item.website);
  const businessName = item.businessName?.trim() || domain || "Prospect sheet";

  if (domain) {
    const leadByDomain = await findLeadByDomain(item.ownerUserId, domain);
    const clientBySite = await findClientByWebsite(domain);

    if (clientBySite || leadByDomain?.convertedClientId) {
      try {
        const result = await runDigitalAuditUnified({
          ownerUserId: item.ownerUserId,
          vatNumber: clientBySite?.vatNumber ?? leadByDomain?.vatNumber ?? undefined,
          website: item.website ?? undefined,
          businessName: item.businessName ?? clientBySite?.companyName,
          acquisitionSource: "sheet_queue",
          createOutreachDraft: true,
          enrichClient: {
            businessName: item.businessName,
            contactEmail: item.contactEmail,
            website: item.website,
            city: item.city,
          },
        });
        await enrichAuditOutreach(result.auditId);
        return {
          status: "DONE",
          auditId: result.auditId,
          clientId: result.clientId,
          leadId: result.leadId,
        };
      } catch (e) {
        return {
          status: "FAILED",
          errorDetail: e instanceof Error ? e.message : "Audit fallito",
        };
      }
    }

    if (leadByDomain) {
      if (leadByDomain.vatNumber) {
        try {
          const result = await runDigitalAuditUnified({
            ownerUserId: item.ownerUserId,
            vatNumber: leadByDomain.vatNumber,
            website: item.website ?? undefined,
            businessName: leadByDomain.businessName ?? businessName,
            leadId: leadByDomain.id,
            acquisitionSource: "sheet_queue",
            createOutreachDraft: true,
          });
          await enrichAuditOutreach(result.auditId);
          return {
            status: "DONE",
            auditId: result.auditId,
            clientId: result.clientId,
            leadId: result.leadId,
          };
        } catch (e) {
          return {
            status: "FAILED",
            errorDetail: e instanceof Error ? e.message : "Audit fallito",
          };
        }
      }
      await ensureSheetFiscalCompletionTask({
        ownerUserId: item.ownerUserId,
        label: businessName,
        leadId: leadByDomain.id,
        domain,
      });
      return {
        status: "SKIPPED",
        leadId: leadByDomain.id,
        errorDetail: "Lead esistente senza P.IVA: audit differito, task completamento creato.",
      };
    }

    const lead = await prisma.lead.create({
      data: {
        ownerUserId: item.ownerUserId,
        title: `Sheet · ${businessName}`,
        businessName,
        website: item.website ?? `https://${domain}`,
        city: item.city ?? undefined,
        email: item.contactEmail ?? undefined,
        status: "QUALIFIED",
        source: "sheet_queue",
        commercialProspectStage: "AUDIT_IN_PROGRESS",
        clientMacroCategory: "DIGITAL_AI",
        notes: `Import sheet dominio ${domain} (senza P.IVA).`,
      },
    });
    await ensureSheetFiscalCompletionTask({
      ownerUserId: item.ownerUserId,
      label: businessName,
      leadId: lead.id,
      domain,
    });
    return {
      status: "SKIPPED",
      leadId: lead.id,
      errorDetail: "Nuovo lead da dominio sheet — audit differito fino a P.IVA.",
    };
  }

  if (item.businessName?.trim() && item.city?.trim()) {
    const name = item.businessName.trim();
    const city = item.city.trim();
    const matches = await prisma.client.findMany({
      where: {
        companyName: { contains: name, mode: "insensitive" },
        city: { contains: city, mode: "insensitive" },
      },
      select: { id: true, companyName: true, vatNumber: true },
      take: 3,
      orderBy: { updatedAt: "desc" },
    });

    if (matches.length === 1 && matches[0].vatNumber) {
      try {
        const result = await runDigitalAuditUnified({
          ownerUserId: item.ownerUserId,
          vatNumber: matches[0].vatNumber,
          businessName: matches[0].companyName,
          city,
          acquisitionSource: "sheet_queue",
          createOutreachDraft: true,
        });
        await enrichAuditOutreach(result.auditId);
        return {
          status: "DONE",
          auditId: result.auditId,
          clientId: result.clientId,
          leadId: result.leadId,
        };
      } catch (e) {
        return {
          status: "FAILED",
          errorDetail: e instanceof Error ? e.message : "Audit fallito",
        };
      }
    }

    if (matches.length > 1) {
      await ensureSheetProspectDataTask({
        ownerUserId: item.ownerUserId,
        label: `${name} (${city})`,
      });
      return {
        status: "SKIPPED",
        errorDetail: "Match debole su ragione sociale+città: revisione manuale.",
      };
    }

    const lead = await prisma.lead.create({
      data: {
        ownerUserId: item.ownerUserId,
        title: `Sheet · ${name}`,
        businessName: name,
        city,
        email: item.contactEmail ?? undefined,
        status: "QUALIFIED",
        source: "sheet_queue",
        commercialProspectStage: "AUDIT_IN_PROGRESS",
        clientMacroCategory: "DIGITAL_AI",
        notes: "Import sheet senza P.IVA/dominio — completare dati.",
      },
    });
    await ensureSheetProspectDataTask({
      ownerUserId: item.ownerUserId,
      label: name,
      leadId: lead.id,
    });
    return {
      status: "SKIPPED",
      leadId: lead.id,
      errorDetail: "Prospect da nome+città: task revisione, audit non avviato.",
    };
  }

  return {
    status: "FAILED",
    errorDetail: "Riga insufficiente: serve P.IVA, dominio, oppure ragione sociale e città.",
  };
}
