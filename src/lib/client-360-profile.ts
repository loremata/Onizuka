import { prisma } from "@/lib/prisma";
import { clientKindBadge, clientKindLabel, clientMacroCategoryLabel } from "@/lib/client-kind";
import { loadClientServiceGaps } from "@/lib/client-commercial-gaps";
import type { ClientKind, ClientMacroCategory } from "@prisma/client";

export type Client360ProfileRow = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
};

export type Client360Profile = {
  identity: {
    kind: ClientKind;
    kindLabel: string;
    macroCategory: ClientMacroCategory | null;
    macroLabel: string | null;
    vatNumber: string | null;
    fiscalCode: string | null;
    fiscalUniqueKey: string | null;
  };
  purchasedServices: { name: string; brand: string | null; notes: string | null }[];
  proposedQuotes: Client360ProfileRow[];
  upsellGaps: { serviceName: string; brandName: string | null }[];
  outreachSent: Client360ProfileRow[];
  outreachPending: Client360ProfileRow[];
  flowDue: Client360ProfileRow[];
  financeEntries: Client360ProfileRow[];
  renewals: Client360ProfileRow[];
  sequences: Client360ProfileRow[];
  personRoles: { personId: string; fullName: string; role: string | null; isPrimary: boolean }[];
};

export async function loadClient360Profile(
  clientId: string,
  ownerUserId: string
): Promise<Client360Profile | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      kind: true,
      vatNumber: true,
      fiscalCode: true,
      clientMacroCategory: true,
      commercialServices: {
        where: { active: true },
        include: { commercialService: { include: { ecosystemBrand: { select: { name: true } } } } },
      },
      personRoles: {
        include: { person: { select: { id: true, fullName: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!client) return null;

  const kind = clientKindBadge(client);
  const fiscalUniqueKey = client.vatNumber?.trim() || client.fiscalCode?.trim() || null;

  const [
    serviceGaps,
    quotes,
    outreachAll,
    flowTasks,
    financeRows,
    retailRenewals,
    sequences,
  ] = await Promise.all([
    loadClientServiceGaps(clientId),
    prisma.opportunityQuote.findMany({
      where: { ownerUserId, opportunity: { clientId } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        opportunityId: true,
      },
    }),
    prisma.outreachDraft.findMany({
      where: { clientId, ownerUserId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        subject: true,
        status: true,
        sentAt: true,
        updatedAt: true,
      },
    }),
    prisma.flowTask.findMany({
      where: {
        relatedClientId: clientId,
        ownerUserId,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      select: { id: true, title: true, dueDate: true, priority: true },
    }),
    prisma.financeEntry.findMany({
      where: { clientId, ownerUserId },
      orderBy: { dueDate: "asc" },
      take: 15,
      select: {
        id: true,
        label: true,
        type: true,
        status: true,
        amountEur: true,
        dueDate: true,
        renewalDate: true,
      },
    }),
    prisma.clientRetailContract.findMany({
      where: { clientId, ownerUserId, status: "ACTIVE" },
      orderBy: { renewalDate: "asc" },
      take: 8,
      select: { id: true, label: true, renewalDate: true, monthlyEur: true },
    }),
    prisma.outreachSequence.findMany({
      where: { clientId, ownerUserId, status: { in: ["ACTIVE", "PAUSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, status: true },
    }),
  ]);

  const purchasedServices = client.commercialServices.map((l) => ({
    name: l.commercialService.name,
    brand: l.commercialService.ecosystemBrand?.name ?? null,
    notes: l.notes,
  }));

  const proposedQuotes: Client360ProfileRow[] = quotes
    .filter((q) => q.status === "DRAFT" || q.status === "SENT")
    .map((q) => ({
      id: q.id,
      title: q.title,
      subtitle: q.status,
      href: `/admin/crm/opportunities/${q.opportunityId}/quotes/${q.id}`,
      meta: new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(q.updatedAt),
    }));

  const outreachSent = outreachAll
    .filter((d) => d.status === "SENT")
    .map((d) => ({
      id: d.id,
      title: d.subject,
      subtitle: d.sentAt
        ? `Inviata ${new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(d.sentAt)}`
        : "Inviata",
      href: `/admin/reach?draft=${d.id}`,
    }));

  const outreachPending = outreachAll
    .filter((d) => d.status !== "SENT" && d.status !== "CANCELLED")
    .map((d) => ({
      id: d.id,
      title: d.subject,
      subtitle: d.status,
      href: `/admin/reach?draft=${d.id}`,
    }));

  const flowDue: Client360ProfileRow[] = flowTasks.map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.priority,
    href: `/admin/flow?clientId=${encodeURIComponent(clientId)}`,
    meta: t.dueDate
      ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(t.dueDate)
      : undefined,
  }));

  const financeEntries: Client360ProfileRow[] = financeRows.map((f) => ({
    id: f.id,
    title: f.label,
    subtitle: `${f.type} · ${f.status} · € ${f.amountEur.toString()}`,
    href: `/admin/finance?clientId=${encodeURIComponent(clientId)}`,
    meta: f.dueDate
      ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(f.dueDate)
      : undefined,
  }));

  const financeClientHref = `/admin/finance?clientId=${encodeURIComponent(clientId)}`;

  const renewals: Client360ProfileRow[] = [
    ...financeRows
      .filter((f) => f.renewalDate)
      .map((f) => ({
        id: `fin-${f.id}`,
        title: `Finance · ${f.label}`,
        subtitle: `Rinnovo MRR`,
        href: financeClientHref,
        meta: f.renewalDate
          ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(f.renewalDate)
          : undefined,
      })),
    ...retailRenewals
      .filter((r) => r.renewalDate)
      .map((r) => ({
        id: r.id,
        title: r.label,
        subtitle: `€ ${r.monthlyEur.toString()}/mese`,
        href: `/admin/clients/${clientId}`,
        meta: r.renewalDate
          ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(r.renewalDate)
          : undefined,
      })),
  ];

  const sequencesRows: Client360ProfileRow[] = sequences.map((s) => ({
    id: s.id,
    title: s.name,
    subtitle: s.status,
    href: `/admin/reach/sequences/${s.id}`,
  }));

  return {
    identity: {
      kind,
      kindLabel: clientKindLabel[kind],
      macroCategory: client.clientMacroCategory,
      macroLabel: client.clientMacroCategory
        ? clientMacroCategoryLabel[client.clientMacroCategory]
        : null,
      vatNumber: client.vatNumber,
      fiscalCode: client.fiscalCode,
      fiscalUniqueKey,
    },
    purchasedServices,
    proposedQuotes,
    upsellGaps: serviceGaps.slice(0, 12).map((g) => ({
      serviceName: g.serviceName,
      brandName: g.brandName,
    })),
    outreachSent,
    outreachPending,
    flowDue,
    financeEntries,
    renewals,
    sequences: sequencesRows,
    personRoles: client.personRoles.map((r) => ({
      personId: r.person.id,
      fullName: r.person.fullName,
      role: r.role,
      isPrimary: r.isPrimary,
    })),
  };
}
