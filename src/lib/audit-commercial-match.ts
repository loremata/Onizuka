import { prisma } from "@/lib/prisma";
import { leadLifecycleForStage } from "@/lib/lead-lifecycle";
import { findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";
import { normalizeFiscalCode, normalizeVatNumber } from "@/lib/fiscal-normalize";
import { ensureBusinessClientByVat } from "@/lib/prospect-vat-pipeline";

export type AuditMatchKind =
  | "existing_client"
  | "existing_lead"
  | "new_prospect"
  | "client_no_prior_audit"
  | "lead_already_audited"
  | "converted_client"
  | "possible_duplicate";

export type AuditAcquisitionSource =
  | "vat_form"
  | "client_button"
  | "sheet_queue"
  | "prospect_pipeline"
  | "google_places"
  | "csv_import"
  | "manual";

export type PrepareAuditCommercialTargetInput = {
  ownerUserId: string;
  vatNumber?: string | null;
  fiscalCode?: string | null;
  website?: string | null;
  businessName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  googlePlaceId?: string | null;
  acquisitionSource?: AuditAcquisitionSource | string | null;
  importBatchId?: string | null;
  clientId?: string | null;
  leadId?: string | null;
};

export type PrepareAuditCommercialTargetResult = {
  clientId: string;
  leadId?: string;
  matchKind: AuditMatchKind;
  warnings: string[];
  createdClient: boolean;
  createdLead: boolean;
};

export function normalizeWebsiteDomain(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const trimmed = raw.trim();
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

async function findClientByWebsite(domain: string) {
  return prisma.client.findFirst({
    where: {
      website: { contains: domain, mode: "insensitive" },
    },
    select: { id: true, companyName: true, vatNumber: true, website: true, status: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function findLeadByGooglePlaceId(ownerUserId: string, placeId: string) {
  return prisma.lead.findFirst({
    where: { ownerUserId, googlePlaceId: placeId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      vatNumber: true,
      businessName: true,
      convertedClientId: true,
      commercialProspectStage: true,
    },
  });
}

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
      title: true,
      vatNumber: true,
      businessName: true,
      convertedClientId: true,
      commercialProspectStage: true,
    },
  });
}

async function findLeadByVat(ownerUserId: string, vat: string) {
  const norm = normalizeVatNumber(vat);
  if (!norm) return null;
  return prisma.lead.findFirst({
    where: {
      ownerUserId,
      OR: [{ vatNumber: { equals: norm, mode: "insensitive" } }, { vatNumber: norm }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      vatNumber: true,
      businessName: true,
      convertedClientId: true,
      commercialProspectStage: true,
    },
  });
}

async function findProbableClientByNameLocation(
  businessName: string,
  city?: string | null
): Promise<{ client: { id: string; companyName: string } | null; ambiguous: boolean }> {
  const name = businessName.trim();
  if (name.length < 3) return { client: null, ambiguous: false };

  const matches = await prisma.client.findMany({
    where: {
      companyName: { contains: name, mode: "insensitive" },
      ...(city?.trim() ? { city: { contains: city.trim(), mode: "insensitive" } } : {}),
    },
    select: { id: true, companyName: true },
    take: 3,
    orderBy: { updatedAt: "desc" },
  });

  if (matches.length === 1) return { client: matches[0], ambiguous: false };
  if (matches.length > 1) return { client: matches[0], ambiguous: true };
  return { client: null, ambiguous: false };
}

async function findOrCreateLeadForClient(params: {
  ownerUserId: string;
  clientId: string;
  vat?: string | null;
  businessName: string;
  existingLeadId?: string;
  website?: string | null;
  city?: string | null;
  googlePlaceId?: string | null;
  source?: string | null;
}): Promise<{ leadId: string; created: boolean }> {
  if (params.existingLeadId) {
    return { leadId: params.existingLeadId, created: false };
  }

  const linked = await prisma.lead.findFirst({
    where: {
      ownerUserId: params.ownerUserId,
      OR: [
        { clientId: params.clientId },
        { convertedClientId: params.clientId },
        ...(params.vat ? [{ vatNumber: params.vat }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, clientId: true },
  });
  if (linked) {
    // Satellite: assicura il link al Client se mancante (lead pre-esistente da P.IVA).
    if (!linked.clientId) {
      await prisma.lead.update({ where: { id: linked.id }, data: { clientId: params.clientId } });
    }
    return { leadId: linked.id, created: false };
  }

  const lead = await prisma.lead.create({
    data: {
      ownerUserId: params.ownerUserId,
      clientId: params.clientId,
      title: `Prospect audit · ${params.businessName}`,
      businessName: params.businessName,
      vatNumber: params.vat ?? undefined,
      website: params.website ?? undefined,
      city: params.city ?? undefined,
      googlePlaceId: params.googlePlaceId ?? undefined,
      status: "QUALIFIED",
      source: params.source ?? "digital_audit",
      commercialProspectStage: "AUDIT_IN_PROGRESS",
      clientMacroCategory: "DIGITAL_AI",
    },
  });
  return { leadId: lead.id, created: true };
}

/**
 * Risolve scheda commerciale corretta prima di eseguire l'audit (regole CM-01).
 */
export async function prepareAuditCommercialTarget(
  input: PrepareAuditCommercialTargetInput
): Promise<PrepareAuditCommercialTargetResult> {
  const warnings: string[] = [];
  const vat = normalizeVatNumber(input.vatNumber);
  const fiscalCode = normalizeFiscalCode(input.fiscalCode);
  const domain = normalizeWebsiteDomain(input.website);
  const placeId = input.googlePlaceId?.trim() || null;
  const sourceTag = input.acquisitionSource ?? "manual";

  let createdClient = false;
  let createdLead = false;

  if (placeId) {
    const leadByPlace = await findLeadByGooglePlaceId(input.ownerUserId, placeId);
    if (leadByPlace) {
      let clientId = leadByPlace.convertedClientId;
      if (!clientId && leadByPlace.vatNumber) {
        const ensured = await ensureBusinessClientByVat({
          vatNumber: leadByPlace.vatNumber,
          macroCategory: "DIGITAL_AI",
        });
        clientId = ensured.clientId;
        createdClient = ensured.created;
      } else if (!clientId) {
        warnings.push("Lead da Google Places senza P.IVA: scheda prospect incompleta.");
        throw new Error(
          "Impossibile eseguire audit senza P.IVA o cliente collegato. Completa i dati fiscali del lead."
        );
      }
      return {
        clientId: clientId!,
        leadId: leadByPlace.id,
        matchKind: "existing_lead",
        warnings,
        createdClient,
        createdLead: false,
      };
    }
  }

  if (input.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, companyName: true, vatNumber: true, status: true },
    });
    if (!client) throw new Error("Cliente non trovato.");

    const priorAudit = await prisma.digitalAudit.count({
      where: { clientId: client.id, ownerUserId: input.ownerUserId, status: "COMPLETED" },
    });

    const convertedLead = await prisma.lead.findFirst({
      where: { convertedClientId: client.id },
      select: { id: true },
    });

    let leadId = input.leadId ?? convertedLead?.id;
    if (!leadId && client.status !== "ACTIVE_CLIENT") {
      const lead = await findOrCreateLeadForClient({
        ownerUserId: input.ownerUserId,
        clientId: client.id,
        vat: client.vatNumber ?? vat,
        businessName: client.companyName,
        website: input.website,
        city: input.city,
        googlePlaceId: placeId,
        source: sourceTag,
      });
      leadId = lead.leadId;
      createdLead = lead.created;
    }

    return {
      clientId: client.id,
      leadId,
      matchKind: convertedLead
        ? "converted_client"
        : priorAudit > 0
          ? "lead_already_audited"
          : "client_no_prior_audit",
      warnings,
      createdClient: false,
      createdLead,
    };
  }

  if (vat || fiscalCode) {
    const fiscalKey = vat ?? fiscalCode!;
    const existingClient = await findClientByFiscalIdentity({ vatNumber: vat, fiscalCode });
    if (existingClient) {
      const priorAudit = await prisma.digitalAudit.count({
        where: { clientId: existingClient.id, ownerUserId: input.ownerUserId },
      });
      const lead = vat ? await findLeadByVat(input.ownerUserId, vat) : null;
      const { leadId, created } = await findOrCreateLeadForClient({
        ownerUserId: input.ownerUserId,
        clientId: existingClient.id,
        vat,
        businessName: input.businessName ?? existingClient.companyName,
        existingLeadId: lead?.id ?? input.leadId ?? undefined,
        website: input.website,
        city: input.city,
        googlePlaceId: placeId,
        source: sourceTag,
      });
      createdLead = created;

      return {
        clientId: existingClient.id,
        leadId,
        matchKind: priorAudit > 0 ? "lead_already_audited" : "existing_client",
        warnings,
        createdClient: false,
        createdLead,
      };
    }

    const lead = vat ? await findLeadByVat(input.ownerUserId, vat) : null;
    if (lead) {
      let clientId = lead.convertedClientId;
      if (!clientId) {
        const ensured = await ensureBusinessClientByVat({ vatNumber: fiscalKey, macroCategory: "DIGITAL_AI" });
        clientId = ensured.clientId;
        createdClient = ensured.created;
        await prisma.lead.update({
          where: { id: lead.id },
          data: leadLifecycleForStage("AUDIT_IN_PROGRESS"),
        });
      }
      return {
        clientId,
        leadId: lead.id,
        matchKind: "existing_lead",
        warnings,
        createdClient,
        createdLead: false,
      };
    }

    const ensured = await ensureBusinessClientByVat({ vatNumber: fiscalKey, macroCategory: "DIGITAL_AI" });
    createdClient = ensured.created;
    const client = await prisma.client.findUniqueOrThrow({
      where: { id: ensured.clientId },
      select: { id: true, companyName: true },
    });
    const { leadId, created } = await findOrCreateLeadForClient({
      ownerUserId: input.ownerUserId,
      clientId: client.id,
      vat,
      businessName: input.businessName ?? client.companyName,
      existingLeadId: input.leadId ?? undefined,
      website: input.website,
      city: input.city,
      googlePlaceId: placeId,
      source: sourceTag,
    });
    createdLead = created;

    return {
      clientId: client.id,
      leadId,
      matchKind: "new_prospect",
      warnings,
      createdClient,
      createdLead,
    };
  }

  if (domain) {
    const leadByDomain = await findLeadByDomain(input.ownerUserId, domain);
    if (leadByDomain?.convertedClientId) {
      const lead = await findOrCreateLeadForClient({
        ownerUserId: input.ownerUserId,
        clientId: leadByDomain.convertedClientId,
        businessName: leadByDomain.businessName ?? input.businessName ?? "Prospect",
        existingLeadId: leadByDomain.id,
        website: input.website,
        city: input.city,
        googlePlaceId: placeId,
        source: sourceTag,
      });
      return {
        clientId: leadByDomain.convertedClientId,
        leadId: lead.leadId,
        matchKind: "existing_lead",
        warnings: [...warnings, `Match dominio ${domain} su lead esistente.`],
        createdClient: false,
        createdLead: lead.created,
      };
    }

    const clientBySite = await findClientByWebsite(domain);
    if (clientBySite) {
      warnings.push(`Match per dominio ${domain} → cliente «${clientBySite.companyName}».`);
      const lead = await findOrCreateLeadForClient({
        ownerUserId: input.ownerUserId,
        clientId: clientBySite.id,
        businessName: clientBySite.companyName,
        existingLeadId: leadByDomain?.id ?? input.leadId ?? undefined,
        website: input.website,
        city: input.city,
        googlePlaceId: placeId,
        source: sourceTag,
      });
      createdLead = lead.created;
      return {
        clientId: clientBySite.id,
        leadId: lead.leadId,
        matchKind: "existing_client",
        warnings,
        createdClient: false,
        createdLead,
      };
    }
    warnings.push(`Dominio ${domain} senza match certo — verifica manuale consigliata.`);
  }

  if (input.businessName?.trim()) {
    const probable = await findProbableClientByNameLocation(input.businessName, input.city);
    if (probable.client) {
      if (probable.ambiguous) {
        warnings.push(
          `Match debole su ragione sociale «${input.businessName}»${input.city ? ` (${input.city})` : ""}: più candidati — revisione consigliata.`
        );
      } else {
        warnings.push(`Match probabile su ragione sociale → «${probable.client.companyName}».`);
      }
      const lead = await findOrCreateLeadForClient({
        ownerUserId: input.ownerUserId,
        clientId: probable.client.id,
        businessName: probable.client.companyName,
        existingLeadId: input.leadId ?? undefined,
        website: input.website,
        city: input.city,
        googlePlaceId: placeId,
        source: sourceTag,
      });
      return {
        clientId: probable.client.id,
        leadId: lead.leadId,
        matchKind: probable.ambiguous ? "possible_duplicate" : "existing_client",
        warnings,
        createdClient: false,
        createdLead: lead.created,
      };
    }
  }

  throw new Error(
    "Dati insufficienti per l'audit: inserire almeno P.IVA valida, oppure selezionare un cliente esistente."
  );
}
