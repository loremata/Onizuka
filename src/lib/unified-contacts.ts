import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizeVat } from "@/lib/client-dedupe";

export type UnifiedContactRow = {
  id: string;
  kind: "lead" | "client";
  displayName: string;
  email: string | null;
  phone: string | null;
  vatOrFiscal: string | null;
  status: string;
  href: string;
  duplicateHints: string[];
};

function matchesQ(
  q: string,
  fields: (string | null | undefined)[]
): boolean {
  const needle = q.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(needle));
}

export async function listUnifiedContacts(
  ownerUserId: string,
  q?: string,
  limit = 300
): Promise<UnifiedContactRow[]> {
  const needle = q?.trim();
  const take = Math.min(Math.max(limit, 1), 500);

  const [leads, clients] = await Promise.all([
    prisma.lead.findMany({
      where: { ownerUserId },
      orderBy: { updatedAt: "desc" },
      take: needle ? 400 : take,
      select: {
        id: true,
        title: true,
        businessName: true,
        contactName: true,
        email: true,
        phone: true,
        vatNumber: true,
        status: true,
      },
    }),
    prisma.client.findMany({
      where: {
        OR: [
          { convertedFromLead: { ownerUserId } },
          { opportunities: { some: { ownerUserId } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: needle ? 400 : take,
      select: {
        id: true,
        companyName: true,
        contactEmail: true,
        phone: true,
        vatNumber: true,
        status: true,
      },
    }),
  ]);

  const rows: UnifiedContactRow[] = [];

  for (const l of leads) {
    const displayName = l.businessName?.trim() || l.title;
    if (needle && !matchesQ(needle, [displayName, l.contactName, l.email, l.phone, l.vatNumber])) continue;
    rows.push({
      id: l.id,
      kind: "lead",
      displayName,
      email: l.email,
      phone: l.phone,
      vatOrFiscal: l.vatNumber,
      status: l.status,
      href: `/admin/crm/leads/${l.id}/edit`,
      duplicateHints: [],
    });
  }

  for (const c of clients) {
    if (needle && !matchesQ(needle, [c.companyName, c.contactEmail, c.phone, c.vatNumber])) continue;
    rows.push({
      id: c.id,
      kind: "client",
      displayName: c.companyName,
      email: c.contactEmail,
      phone: c.phone,
      vatOrFiscal: c.vatNumber,
      status: c.status,
      href: `/admin/clients/${c.id}`,
      duplicateHints: [],
    });
  }

  const emailIndex = new Map<string, string[]>();
  const vatIndex = new Map<string, string[]>();
  for (const r of rows) {
    const em = normalizeEmail(r.email);
    if (em) {
      const list = emailIndex.get(em) ?? [];
      list.push(r.id);
      emailIndex.set(em, list);
    }
    const vat = normalizeVat(r.vatOrFiscal);
    if (vat) {
      const list = vatIndex.get(vat) ?? [];
      list.push(r.id);
      vatIndex.set(vat, list);
    }
  }

  for (const r of rows) {
    const hints: string[] = [];
    const em = normalizeEmail(r.email);
    if (em && (emailIndex.get(em)?.length ?? 0) > 1) hints.push("email duplicata");
    const vat = normalizeVat(r.vatOrFiscal);
    if (vat && (vatIndex.get(vat)?.length ?? 0) > 1) hints.push("P.IVA duplicata");
    r.duplicateHints = hints;
  }

  return rows
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "it"))
    .slice(0, take);
}
