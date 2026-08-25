import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/**
 * IL PONTE NEGOZIO ↔ CRM.
 *
 * Perché serviva: 89 vendite al banco, ZERO agganciate a un cliente. Il
 * meccanismo di propagazione esisteva già (applySaleToClient attiva il
 * contratto retail e fa uscire il cliente dalle campagne del servizio che ora
 * possiede), ma il selettore del form offriva solo i clienti già a CRM — due —
 * e chi entra in negozio a CRM non c'è. Non c'era nulla da selezionare.
 *
 * Qui si chiude il cerchio: dal banco si cerca per NOME o TELEFONO (in negozio
 * si identificano le persone dal numero) e, se non esiste, la si crea in due
 * campi. È il collegamento che rende l'ecosistema un ecosistema: il tizio a cui
 * hai attivato la fibra è anche il bar che non ha il sito.
 */

/** Solo cifre, ultime 9: confronto robusto tra +39, spazi, prefissi. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

export type CounterClientHit = {
  id: string;
  companyName: string;
  phone: string | null;
  /** true = è ancora un prospect: agganciarlo qui lo promuove a cliente. */
  isLead: boolean;
};

/**
 * Ricerca per il banco: nome o telefono. Include anche i LEAD, non solo i
 * clienti: se l'attività che entra in negozio è già tra i prospect scrapati,
 * quello è esattamente il momento in cui diventa cliente.
 */
export async function searchCounterClients(q: string, limit = 8): Promise<CounterClientHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const digits = term.replace(/\D/g, "");
  const rows = await prisma.client.findMany({
    where: {
      OR: [
        { companyName: { contains: term, mode: "insensitive" } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ],
    },
    select: { id: true, companyName: true, phone: true, relationshipState: true },
    orderBy: [{ relationshipState: "asc" }, { companyName: "asc" }],
    take: limit * 3,
  });

  // Il telefono a DB può avere spazi/prefissi: rifiltro sulle cifre.
  const filtered =
    digits.length >= 4
      ? rows.filter(
          (r) =>
            r.companyName.toLowerCase().includes(term.toLowerCase()) ||
            (r.phone ?? "").replace(/\D/g, "").includes(digits)
        )
      : rows;

  return filtered.slice(0, limit).map((r) => ({
    id: r.id,
    companyName: r.companyName,
    phone: r.phone,
    isLead: r.relationshipState !== "CLIENTE",
  }));
}

export type CounterClientResult =
  | { ok: true; id: string; companyName: string; reused: boolean }
  | { ok: false; error: string };

/** Email sensata e non un segnaposto nostro: solo allora vale come recapito. */
function normalizeCounterEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  if (/@onizuka\.local$/.test(email)) return null;
  return email;
}

/**
 * Crea (o riusa) il cliente dal banco con due soli campi.
 *
 * Riuso sul TELEFONO prima di creare: al banco si registra di fretta e senza
 * questo controllo si genererebbero doppioni a ogni vendita della stessa
 * persona — proprio il problema da cui veniamo (306 clienti duplicati per
 * telefono). Chi compra è un cliente, quindi nasce già CLIENTE/ACTIVE_CLIENT.
 *
 * L'email è FACOLTATIVA e non rallenta niente: se il cliente la lascia (e dice
 * sì alle offerte) entra nella base raggiungibile con base SOFT_OPT_IN — è un
 * cliente reale che ha appena comprato, il caso da manuale dell'art. 130(4).
 * Senza email resta il segnaposto interno: fuori da qualsiasi invio, come prima.
 * Ogni vendita senza recapito è un cross-sell perso: 176 registrate, 0 contattabili.
 */
export async function createCounterClient(params: {
  ownerUserId: string;
  name: string;
  phone: string;
  /** Facoltativa: chiesta al banco solo se il cliente ha due secondi. */
  email?: string | null;
  /** true = il cliente ha detto sì a ricevere offerte via email. */
  marketingOk?: boolean;
}): Promise<CounterClientResult> {
  const name = params.name.trim();
  const phone = params.phone.trim();
  if (name.length < 2) return { ok: false, error: "Serve il nome del cliente." };

  const key = phoneKey(phone);
  if (!key) return { ok: false, error: "Serve un telefono valido (almeno 8 cifre)." };

  const email = normalizeCounterEmail(params.email);
  const consentBasis = email && params.marketingOk ? ("SOFT_OPT_IN" as const) : null;

  // Riuso: stesso numero già a sistema ⇒ nessun doppione.
  const candidates = await prisma.client.findMany({
    where: { phone: { not: null } },
    select: { id: true, companyName: true, phone: true, relationshipState: true },
  });
  const existing = candidates.find((c) => phoneKey(c.phone) === key);
  if (existing) {
    // Se era un prospect, comprando diventa cliente. E se stavolta ha lasciato
    // l'email, la si aggancia — ma solo sopra un segnaposto: un recapito reale
    // già presente non si sovrascrive da un campo compilato di fretta al banco.
    const current = await prisma.client.findUnique({
      where: { id: existing.id },
      select: { contactEmail: true, marketingConsentBasis: true },
    });
    const emailIsPlaceholder =
      !current?.contactEmail || /@onizuka\.local$/i.test(current.contactEmail);
    await prisma.client
      .update({
        where: { id: existing.id },
        data: {
          ...(existing.relationshipState !== "CLIENTE"
            ? { relationshipState: "CLIENTE" as const, status: "ACTIVE_CLIENT" as const }
            : {}),
          ...(email && emailIsPlaceholder ? { contactEmail: email } : {}),
          // Il consenso si alza (NONE → SOFT_OPT_IN), mai si abbassa da qui.
          ...(consentBasis && current?.marketingConsentBasis === "NONE"
            ? { marketingConsentBasis: consentBasis }
            : {}),
        },
      })
      .catch(() => undefined);
    return { ok: true, id: existing.id, companyName: existing.companyName, reused: true };
  }

  let slug = slugify(name) || "cliente";
  for (let n = 0; n < 50; n++) {
    const taken = await prisma.client.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) break;
    slug = `${slugify(name) || "cliente"}-${n + 1}`;
  }

  try {
    const created = await prisma.client.create({
      data: {
        companyName: name,
        slug,
        // Con l'email vera il cliente diventa raggiungibile; senza, il
        // segnaposto lo tiene giustamente fuori da qualsiasi invio.
        contactEmail: email ?? `store+${key}@onizuka.local`,
        phone,
        relationshipState: "CLIENTE",
        status: "ACTIVE_CLIENT",
        ...(consentBasis ? { marketingConsentBasis: consentBasis } : {}),
      },
      select: { id: true, companyName: true },
    });
    return { ok: true, id: created.id, companyName: created.companyName, reused: false };
  } catch {
    return { ok: false, error: "Creazione cliente non riuscita." };
  }
}
