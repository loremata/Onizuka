import { prisma } from "@/lib/prisma";
import { normalizeFiscalCode, normalizeVatNumber } from "@/lib/fiscal-normalize";

export type FiscalIdentityLookup = {
  id: string;
  companyName: string;
  vatNumber: string | null;
  fiscalCode: string | null;
};

/** Trova cliente esistente per P.IVA o CF (scheda univoca). */
export async function findClientByFiscalIdentity(params: {
  vatNumber?: string | null;
  fiscalCode?: string | null;
  excludeClientId?: string;
}): Promise<FiscalIdentityLookup | null> {
  const vat = normalizeVatNumber(params.vatNumber);
  const cf = normalizeFiscalCode(params.fiscalCode);
  if (!vat && !cf) return null;

  const or: { vatNumber?: object; fiscalCode?: object }[] = [];
  if (vat) {
    or.push({ vatNumber: { equals: vat, mode: "insensitive" } });
  }
  if (cf) {
    or.push({ fiscalCode: { equals: cf, mode: "insensitive" } });
  }

  const client = await prisma.client.findFirst({
    where: {
      ...(params.excludeClientId ? { id: { not: params.excludeClientId } } : {}),
      OR: or,
    },
    select: { id: true, companyName: true, vatNumber: true, fiscalCode: true },
    orderBy: { updatedAt: "desc" },
  });

  return client;
}

export type FiscalIdentityConflict = {
  error: string;
  existingClientId: string;
  existingCompanyName: string;
};

/** Blocca duplicati P.IVA/CF su altre schede. */
export async function assertFiscalIdentityUnique(params: {
  vatNumber?: string | null;
  fiscalCode?: string | null;
  excludeClientId?: string;
}): Promise<FiscalIdentityConflict | null> {
  const existing = await findClientByFiscalIdentity(params);
  if (!existing) return null;

  const vat = normalizeVatNumber(params.vatNumber);
  const cf = normalizeFiscalCode(params.fiscalCode);
  const sameVat =
    vat && existing.vatNumber && normalizeVatNumber(existing.vatNumber) === vat;
  const sameCf =
    cf && existing.fiscalCode && normalizeFiscalCode(existing.fiscalCode) === cf;

  const label = sameVat
    ? `P.IVA ${vat}`
    : sameCf
      ? `CF ${cf}`
      : "identificativo fiscale";

  return {
    error: `${label} già associato a «${existing.companyName}». Apri la scheda esistente o unifica da Dedupe.`,
    existingClientId: existing.id,
    existingCompanyName: existing.companyName,
  };
}

/**
 * Valida coerenza P.IVA lead ↔ client già collegato (`convertedClientId`).
 * Non blocca lead con P.IVA esistente su altro client se non c'è link (funnel prospect).
 */
export async function assertLeadVatClientLink(params: {
  vatNumber?: string | null;
  convertedClientId?: string | null;
}): Promise<FiscalIdentityConflict | null> {
  if (!params.convertedClientId) return null;

  const vat = normalizeVatNumber(params.vatNumber);
  const linked = await prisma.client.findUnique({
    where: { id: params.convertedClientId },
    select: { id: true, companyName: true, vatNumber: true },
  });
  if (!linked) return null;

  const linkedVat = normalizeVatNumber(linked.vatNumber);
  if (vat && linkedVat && vat !== linkedVat) {
    return {
      error: `P.IVA lead non coincide con il cliente collegato «${linked.companyName}».`,
      existingClientId: linked.id,
      existingCompanyName: linked.companyName,
    };
  }

  if (vat) {
    const existing = await findClientByFiscalIdentity({ vatNumber: vat });
    if (existing && existing.id !== params.convertedClientId) {
      return {
        error: `P.IVA ${vat} appartiene già a «${existing.companyName}». Apri /admin/clients/${existing.id} o collega quel cliente.`,
        existingClientId: existing.id,
        existingCompanyName: existing.companyName,
      };
    }
  }

  return null;
}

/** Risolve scheda canonica: per P.IVA/CF ritorna id esistente se presente. */
export async function resolveCanonicalClientId(params: {
  vatNumber?: string | null;
  fiscalCode?: string | null;
  preferredClientId?: string;
}): Promise<string | null> {
  if (params.preferredClientId) {
    const c = await prisma.client.findUnique({
      where: { id: params.preferredClientId },
      select: { id: true },
    });
    if (c) return c.id;
  }
  const found = await findClientByFiscalIdentity({
    vatNumber: params.vatNumber,
    fiscalCode: params.fiscalCode,
  });
  return found?.id ?? null;
}
