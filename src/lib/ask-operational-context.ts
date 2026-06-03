import { dateTimeFormatIt } from "@/lib/datetime-it";
import { prisma } from "@/lib/prisma";

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

/** Contesto CRM/Flow/Finance per Ask (keyword, senza inventare dati). */
export async function buildAskOperationalContext(
  ownerUserId: string,
  query: string
): Promise<string> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return "";

  const contains = tokens.map((t) => ({
    OR: [
      { companyName: { contains: t, mode: "insensitive" as const } },
      { notes: { contains: t, mode: "insensitive" as const } },
    ],
  }));

  try {
  const [clients, opportunities, tasks, overdueFinance] = await Promise.all([
    prisma.client.findMany({
      where: { OR: contains },
      take: 4,
      select: { id: true, companyName: true, status: true, city: true },
    }),
    prisma.opportunity.findMany({
      where: {
        ownerUserId,
        status: "OPEN",
        OR: tokens.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })),
      },
      take: 4,
      select: { id: true, title: true, estimatedValue: true, status: true, priority: true },
    }),
    prisma.flowTask.findMany({
      where: {
        ownerUserId,
        status: { in: ["TODO", "IN_PROGRESS", "WAITING"] },
        OR: tokens.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })),
      },
      take: 4,
      select: { id: true, title: true, dueDate: true, priority: true },
    }),
    prisma.financeEntry.count({
      where: { ownerUserId, status: "OVERDUE" },
    }),
  ]);

  const lines: string[] = [];

  if (clients.length > 0) {
    lines.push(
      "Clienti:",
      ...clients.map(
        (c) =>
          `- ${c.companyName} (${c.status}${c.city ? ` · ${c.city}` : ""}) → /admin/clients/${c.id}`
      )
    );
  }

  if (opportunities.length > 0) {
    lines.push(
      "Opportunità aperte:",
      ...opportunities.map((o) => {
        const val = o.estimatedValue ? Number(o.estimatedValue.toString()) : 0;
        return `- ${o.title} · ${o.status}/${o.priority}${val ? ` · € ${val.toLocaleString("it-IT")}` : ""} → /admin/crm/opportunities/${o.id}/edit`;
      })
    );
  }

  if (tasks.length > 0) {
    const fmt = dateTimeFormatIt({ dateStyle: "short" });
    lines.push(
      "Task Flow:",
      ...tasks.map(
        (t) =>
          `- ${t.title} (${t.priority}${t.dueDate ? ` · scad. ${fmt.format(t.dueDate)}` : ""}) → /admin/flow`
      )
    );
  }

  if (overdueFinance > 0 && /\bfinanz|incass|scadut|fattur|cashflow\b/i.test(query)) {
    lines.push(`Finance: ${overdueFinance} voci scadute → /admin/finance`);
  }

  if (/\baudit\b/i.test(query)) {
    const audits = await prisma.digitalAudit.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        businessName: true,
        overallScore: true,
        createdAt: true,
        client: { select: { companyName: true } },
      },
    });
    if (audits.length > 0) {
      lines.push(
        "Audit recenti:",
        ...audits.map(
          (a) =>
            `- ${a.businessName ?? a.client?.companyName ?? "—"} · score ${a.overallScore ?? "—"} → /admin/audit/digital/${a.id}`
        )
      );
    }
  }

  return lines.length > 0 ? lines.join("\n") : "";
  } catch {
    return "";
  }
}
