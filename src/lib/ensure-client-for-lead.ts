import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { findClientByFiscalIdentity } from "@/lib/client-fiscal-identity";
import { inferClientKind } from "@/lib/client-kind";
import {
  DEFAULT_MARKETING_POLICY,
  resolveAutoConsentBasis,
} from "@/lib/marketing-consent-policy";

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
      // Serve per leggere la politica di classificazione del titolare.
      owner: { select: { marketingAutoBasis: true, marketingExcludedDomains: true } },
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
  // Base giuridica secondo la politica del titolare: senza questo passaggio il
  // Client nascerebbe con il default della colonna (NONE) e nessun contatto
  // acquisito da fonti pubbliche sarebbe più raggiungibile.
  const marketingConsentBasis = resolveAutoConsentBasis(
    lead.email,
    lead.owner ?? DEFAULT_MARKETING_POLICY
  );
  const data = (s: string) => ({
    companyName,
    slug: s,
    contactEmail,
    status: "LEAD_QUALIFIED" as const,
    relationshipState: "LEAD" as const,
    kind,
    marketingConsentBasis,
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

/**
 * Ripropaga l'anagrafica del Lead sul Client collegato (stessa entità, modello satellite).
 * Va chiamata dopo l'update di un Lead: alla creazione/conversione l'anagrafica viene copiata
 * una volta sola, quindi senza questa sync i due record divergono a ogni modifica successiva.
 *
 * Aggiorna SOLO i campi anagrafici condivisi (businessName→companyName, email→contactEmail,
 * phone, vatNumber, fiscalCode, website, city, clientMacroCategory). NON tocca campi specifici
 * del Client (slug, relationshipState, status, tags, note). Idempotente e best-effort:
 * se il lead non ha Client collegato o il Client non esiste, è un no-op; eventuali conflitti
 * (es. P.IVA/CF già usati da un altro Client) non devono rompere l'update del Lead.
 */
export async function syncLeadIdentityToClient(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      clientId: true,
      convertedClientId: true,
      businessName: true,
      email: true,
      phone: true,
      vatNumber: true,
      fiscalCode: true,
      website: true,
      city: true,
      clientMacroCategory: true,
      owner: { select: { marketingAutoBasis: true, marketingExcludedDomains: true } },
    },
  });
  if (!lead) return;
  const clientId = lead.clientId ?? lead.convertedClientId;
  if (!clientId) return;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      relationshipState: true,
      companyName: true,
      contactEmail: true,
      phone: true,
      vatNumber: true,
      fiscalCode: true,
      website: true,
      city: true,
      clientMacroCategory: true,
      marketingConsentBasis: true,
      marketingOptOutAt: true,
    },
  });
  if (!client) return;

  // Non azzeriamo mai i campi obbligatori del Client (companyName/contactEmail) né sovrascriviamo
  // con null i campi opzionali: propaghiamo solo i valori presenti sul Lead (?? undefined = skip).
  const companyName = lead.businessName?.trim() || undefined;
  const contactEmail = lead.email?.trim() || undefined;

  /**
   * Il Lead è fonte di verità SOLO finché il Client è il suo satellite (creato da
   * `ensureClientForLead`, ancora in stato LEAD e con l'email segnaposto). Appena
   * il Client è un cliente vero, il Lead può soltanto ARRICCHIRE i campi ancora
   * vuoti: prima vinceva sempre il Lead, così correggere ragione sociale ed email
   * sulla scheda cliente e poi salvare il vecchio lead — anche solo per una nota —
   * riportava indietro i dati buoni, senza avviso.
   */
  const isSatellite =
    client.relationshipState === "LEAD" && client.contactEmail.endsWith("@onizuka.local");

  const fill = <T,>(current: T | null | undefined, incoming: T | null | undefined) => {
    if (incoming == null || incoming === ("" as unknown as T)) return undefined;
    if (isSatellite) return incoming;
    return current == null || current === ("" as unknown as T) ? incoming : undefined;
  };

  // Il satellite passa dal segnaposto a un indirizzo vero (arricchimento, GBP,
  // sito): è il momento in cui va valutata la base giuridica, altrimenti resta
  // NONE e quel contatto non sarà mai raggiungibile.
  const promotingPlaceholder =
    Boolean(contactEmail) &&
    client.contactEmail.endsWith("@onizuka.local") &&
    !contactEmail!.endsWith("@onizuka.local");
  const rebasedConsent =
    promotingPlaceholder && client.marketingConsentBasis === "NONE" && !client.marketingOptOutAt
      ? resolveAutoConsentBasis(contactEmail, lead.owner ?? DEFAULT_MARKETING_POLICY)
      : undefined;

  try {
    await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(companyName && (isSatellite || !client.companyName.trim()) ? { companyName } : {}),
        ...(contactEmail && (isSatellite || client.contactEmail.endsWith("@onizuka.local"))
          ? { contactEmail }
          : {}),
        ...(rebasedConsent && rebasedConsent !== "NONE"
          ? { marketingConsentBasis: rebasedConsent }
          : {}),
        phone: fill(client.phone, lead.phone),
        vatNumber: fill(client.vatNumber, lead.vatNumber),
        fiscalCode: fill(client.fiscalCode, lead.fiscalCode),
        website: fill(client.website, lead.website),
        city: fill(client.city, lead.city),
        clientMacroCategory: fill(client.clientMacroCategory, lead.clientMacroCategory),
      },
    });
  } catch (e) {
    console.error("syncLeadIdentityToClient failed", e);
  }
}
