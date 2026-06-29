import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";
import { inferClientKind } from "@/lib/client-kind";

async function uniqueClientSlug(base: string): Promise<string> {
  let s = slugify(base) || "lead";
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.client.findUnique({ where: { slug: s }, select: { id: true } });
    if (!exists) return s;
    n += 1;
    s = `${slugify(base) || "lead"}-${n}`;
  }
}

/**
 * Completa il pattern satellite: garantisce che ogni Lead abbia un Client (identità
 * unica, relationshipState=LEAD). Così non esistono più entità "solo-lead" invisibili
 * nell'anagrafica. No-op se il lead è già collegato a un Client. Ritorna il clientId.
 * Best-effort: in caso di errore non blocca la creazione del lead.
 */
export async function ensureClientForLead(leadId: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      clientId: true,
      convertedClientId: true,
      title: true,
      businessName: true,
      email: true,
      phone: true,
      vatNumber: true,
      fiscalCode: true,
      website: true,
      city: true,
      clientMacroCategory: true,
    },
  });
  if (!lead) return null;
  if (lead.clientId) return lead.clientId;
  if (lead.convertedClientId) {
    await prisma.lead.update({ where: { id: leadId }, data: { clientId: lead.convertedClientId } });
    return lead.convertedClientId;
  }

  // 1) Identità fiscale: riusa il Client esistente se P.IVA/CF combaciano (no doppioni).
  if (lead.vatNumber || lead.fiscalCode) {
    const existing = await findClientByFiscalIdentity({
      vatNumber: lead.vatNumber,
      fiscalCode: lead.fiscalCode,
    });
    if (existing) {
      await prisma.lead.update({ where: { id: leadId }, data: { clientId: existing.id } });
      return existing.id;
    }
  }

  // 2) Crea il Client satellite (stato LEAD).
  const companyName = lead.businessName?.trim() || lead.title.trim() || "Prospect";
  const contactEmail = lead.email?.trim() || `lead+${lead.id}@onizuka.local`;
  const kind = inferClientKind({ vatNumber: lead.vatNumber, fiscalCode: lead.fiscalCode });
  const slug = await uniqueClientSlug(companyName);
  const data = (s: string) => ({
    companyName,
    slug: s,
    contactEmail,
    status: "LEAD_QUALIFIED" as const,
    relationshipState: "LEAD" as const,
    kind,
    vatNumber: lead.vatNumber ?? undefined,
    fiscalCode: lead.fiscalCode ?? undefined,
    phone: lead.phone ?? undefined,
    website: lead.website ?? undefined,
    city: lead.city ?? undefined,
    clientMacroCategory: lead.clientMacroCategory ?? undefined,
  });

  try {
    const client = await prisma.client.create({ data: data(slug) });
    await prisma.lead.update({ where: { id: leadId }, data: { clientId: client.id } });
    return client.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Race: un altro processo ha creato lo stesso Client (P.IVA) o lo slug collide.
      if (lead.vatNumber || lead.fiscalCode) {
        const again = await findClientByFiscalIdentity({
          vatNumber: lead.vatNumber,
          fiscalCode: lead.fiscalCode,
        });
        if (again) {
          await prisma.lead.update({ where: { id: leadId }, data: { clientId: again.id } });
          return again.id;
        }
      }
      const client = await prisma.client.create({ data: data(`${slug}-${Date.now().toString(36)}`) });
      await prisma.lead.update({ where: { id: leadId }, data: { clientId: client.id } });
      return client.id;
    }
    console.error("ensureClientForLead failed", e);
    return null;
  }
}
