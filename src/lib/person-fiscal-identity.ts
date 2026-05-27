import { prisma } from "@/lib/prisma";
import { normalizeFiscalCode } from "@/lib/fiscal-normalize";

export type PersonFiscalLookup = {
  id: string;
  fullName: string;
  fiscalCode: string | null;
};

/** Trova persona per CF normalizzato (per owner). */
export async function findPersonByFiscalCode(params: {
  ownerUserId: string;
  fiscalCode?: string | null;
  excludePersonId?: string;
}): Promise<PersonFiscalLookup | null> {
  const cf = normalizeFiscalCode(params.fiscalCode);
  if (!cf) return null;

  return prisma.person.findFirst({
    where: {
      ownerUserId: params.ownerUserId,
      ...(params.excludePersonId ? { id: { not: params.excludePersonId } } : {}),
      fiscalCode: { equals: cf, mode: "insensitive" },
    },
    select: { id: true, fullName: true, fiscalCode: true },
    orderBy: { updatedAt: "desc" },
  });
}

export type PersonFiscalConflict = {
  error: string;
  existingPersonId: string;
  existingFullName: string;
};

/** Blocca duplicati CF su altre persone dello stesso owner. */
export async function assertPersonFiscalUnique(params: {
  ownerUserId: string;
  fiscalCode?: string | null;
  excludePersonId?: string;
}): Promise<PersonFiscalConflict | null> {
  const existing = await findPersonByFiscalCode(params);
  if (!existing) return null;

  const cf = normalizeFiscalCode(params.fiscalCode);
  return {
    error: `Codice fiscale ${cf} già associato a «${existing.fullName}». Apri /admin/crm/people/${existing.id}.`,
    existingPersonId: existing.id,
    existingFullName: existing.fullName,
  };
}
