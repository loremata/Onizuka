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

/**
 * Crea (o riusa) il cliente dal banco con due soli campi.
 *
 * Riuso sul TELEFONO prima di creare: al banco si registra di fretta e senza
 * questo controllo si genererebbero doppioni a ogni vendita della stessa
 * persona — proprio il problema da cui veniamo (306 clienti duplicati per
 * telefono). Chi compra è un cliente, quindi nasce già CLIENTE/ACTIVE_CLIENT.
 *
 * L'email è un segnaposto interno: al banco non si raccoglie, e senza un
 * recapito vero il soggetto resta giustamente fuori da qualsiasi invio.
 */
export async function createCounterClient(params: {
  ownerUserId: string;
  name: string;
  phone: string;
}): Promise<CounterClientResult> {
  const name = params.name.trim();
  const phone = params.phone.trim();
  if (name.length < 2) return { ok: false, error: "Serve il nome del cliente." };

  const key = phoneKey(phone);
  if (!key) return { ok: false, error: "Serve un telefono valido (almeno 8 cifre)." };

  // Riuso: stesso numero già a sistema ⇒ nessun doppione.
  const candidates = await prisma.client.findMany({
    where: { phone: { not: null } },
    select: { id: true, companyName: true, phone: true, relationshipState: true },
  });
  const existing = candidates.find((c) => phoneKey(c.phone) === key);
  if (existing) {
    // Se era un prospect, comprando diventa cliente.
    if (existing.relationshipState !== "CLIENTE") {
      await prisma.client
        .update({
          where: { id: existing.id },
          data: { relationshipState: "CLIENTE", status: "ACTIVE_CLIENT" },
        })
        .catch(() => undefined);
    }
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
        // Segnaposto coerente con le altre origini: nessun recapito email
        // raccolto al banco ⇒ nessun invio possibile, ed è corretto così.
        contactEmail: `store+${key}@onizuka.local`,
        phone,
        relationshipState: "CLIENTE",
        status: "ACTIVE_CLIENT",
      },
      select: { id: true, companyName: true },
    });
    return { ok: true, id: created.id, companyName: created.companyName, reused: false };
  } catch {
    return { ok: false, error: "Creazione cliente non riuscita." };
  }
}
