import { prisma } from "@/lib/prisma";
import { probeWebsiteWithSubpages } from "@/lib/website-probe";
import {
  DEFAULT_MARKETING_POLICY,
  resolveAutoConsentBasis,
  type MarketingPolicy,
} from "@/lib/marketing-consent-policy";

/**
 * RECUPERO CONTATTI dalle fonti pubbliche dell'azienda (il suo sito web).
 *
 * Due usi:
 *  1. `applyFoundContacts` — punto UNICO di scrittura quando un probe (audit o
 *     batch) trova email/telefono: aggiorna Client e Lead con le guardie
 *     anti-sovrascrittura e RIVALUTA la base giuridica. Prima l'audit scriveva
 *     l'email ma lasciava `marketingConsentBasis = NONE`: contatto trovato e
 *     comunque non raggiungibile.
 *  2. `enrichPendingLeadContacts` — batch per i lead che un audit non lo
 *     avranno mai o l'hanno avuto prima che l'estrazione esistesse: prende i
 *     lead con sito ma senza email reale, sonda il sito (home + pagina
 *     contatti, stessa guardia SSRF dell'audit) e applica i contatti trovati.
 *
 * La disciplina resta quella dell'outreach: origine dichiarata nel messaggio e
 * disiscrizione funzionante. Trovare l'email non bypassa il consenso: rende il
 * soggetto valutabile secondo la politica del titolare.
 */

const PLACEHOLDER_RE = /@onizuka\.local$/i;

export type FoundContacts = { email?: string | null; phone?: string | null };

export type ApplyResult = {
  emailApplied: boolean;
  phoneApplied: boolean;
  consentRebased: boolean;
};

async function ownerPolicy(ownerUserId: string | null): Promise<MarketingPolicy> {
  if (!ownerUserId) return DEFAULT_MARKETING_POLICY;
  const u = await prisma.user
    .findUnique({
      where: { id: ownerUserId },
      select: { marketingAutoBasis: true, marketingExcludedDomains: true },
    })
    .catch(() => null);
  return u ?? DEFAULT_MARKETING_POLICY;
}

/**
 * Scrive i contatti trovati su Client (e Lead satellite, se indicato).
 * Email: solo se quella attuale è vuota o segnaposto. Telefono: solo se vuoto.
 * Base giuridica: rivalutata solo da NONE e mai dopo una disiscrizione.
 */
export async function applyFoundContacts(params: {
  clientId: string;
  leadId?: string | null;
  found: FoundContacts;
}): Promise<ApplyResult> {
  const { clientId, leadId, found } = params;
  const result: ApplyResult = { emailApplied: false, phoneApplied: false, consentRebased: false };
  if (!found.email && !found.phone) return result;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      contactEmail: true,
      phone: true,
      marketingConsentBasis: true,
      marketingOptOutAt: true,
    },
  });
  if (!client) return result;

  const data: {
    contactEmail?: string;
    phone?: string;
    marketingConsentBasis?: import("@prisma/client").MarketingConsentBasis;
  } = {};

  const currentEmail = client.contactEmail?.trim() ?? "";
  const emailIsPlaceholder = !currentEmail || PLACEHOLDER_RE.test(currentEmail);
  if (found.email && emailIsPlaceholder && !PLACEHOLDER_RE.test(found.email)) {
    data.contactEmail = found.email.trim().toLowerCase();
    result.emailApplied = true;
  }

  if (found.phone && !client.phone?.trim()) {
    data.phone = found.phone.trim();
    result.phoneApplied = true;
  }

  // Email vera appena arrivata su un soggetto senza base: valuta secondo la
  // politica del titolare (di default: legittimo interesse su recapito pubblico).
  if (
    result.emailApplied &&
    client.marketingConsentBasis === "NONE" &&
    !client.marketingOptOutAt
  ) {
    const lead = leadId
      ? await prisma.lead.findUnique({ where: { id: leadId }, select: { ownerUserId: true } })
      : null;
    const basis = resolveAutoConsentBasis(data.contactEmail, await ownerPolicy(lead?.ownerUserId ?? null));
    if (basis !== "NONE") {
      data.marketingConsentBasis = basis;
      result.consentRebased = true;
    }
  }

  if (Object.keys(data).length === 0) return result;

  await prisma.client.update({ where: { id: clientId }, data }).catch(() => undefined);

  if (leadId) {
    if (result.emailApplied && data.contactEmail) {
      await prisma.lead
        .updateMany({
          where: { id: leadId, OR: [{ email: null }, { email: "" }] },
          data: { email: data.contactEmail },
        })
        .catch(() => undefined);
    }
    if (result.phoneApplied && data.phone) {
      await prisma.lead
        .updateMany({
          where: { id: leadId, OR: [{ phone: null }, { phone: "" }] },
          data: { phone: data.phone },
        })
        .catch(() => undefined);
    }
  }

  return result;
}

export type EnrichBatchResult = {
  scanned: number;
  emailsFound: number;
  phonesFound: number;
};

/**
 * Batch: lead con sito ma senza email reale, mai tentati (o tentati più di 30
 * giorni fa). Un probe per lead (home + pagina contatti), poi scrittura via
 * `applyFoundContacts`. Pensato per girare in coda al cron scraping-audit con
 * un limite piccolo: il probe costa fino a ~30s per sito lento.
 */
export async function enrichPendingLeadContacts(limit = 3): Promise<EnrichBatchResult> {
  const retryBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: {
      website: { not: null },
      OR: [{ email: null }, { email: "" }],
      clientId: { not: null },
      status: { notIn: ["CONVERTED", "LOST"] },
      AND: [
        { OR: [{ contactEnrichedAt: null }, { contactEnrichedAt: { lt: retryBefore } }] },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: Math.max(1, Math.min(limit, 10)),
    select: { id: true, website: true, clientId: true },
  });

  const result: EnrichBatchResult = { scanned: 0, emailsFound: 0, phonesFound: 0 };

  for (const lead of leads) {
    result.scanned += 1;
    // Il tentativo si marca PRIMA del probe: un sito che manda in timeout il
    // run non deve essere ritentato a ogni giro per altri 30 giorni.
    await prisma.lead
      .update({ where: { id: lead.id }, data: { contactEnrichedAt: new Date() } })
      .catch(() => undefined);

    const probe = await probeWebsiteWithSubpages(lead.website).catch(() => null);
    if (!probe || (!probe.email && !probe.phone)) continue;

    const applied = await applyFoundContacts({
      clientId: lead.clientId!,
      leadId: lead.id,
      found: { email: probe.email ?? null, phone: probe.phone ?? null },
    });
    if (applied.emailApplied) result.emailsFound += 1;
    if (applied.phoneApplied) result.phonesFound += 1;
  }

  return result;
}
