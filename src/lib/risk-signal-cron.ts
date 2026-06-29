import { prisma } from "@/lib/prisma";
import { lifecycleForStatus } from "@/lib/client-lifecycle";

/**
 * Trasforma i segnali di rischio in azioni (prima morivano in notifiche o conteggi):
 *  - finance scaduto per cliente → FlowTask di sollecito,
 *  - 2+ insoluti su cliente ATTIVO → churn automatico a DORMANT + task di recupero,
 *  - SLA ticket sforata → FlowTask urgente.
 * Tutti i task sono idempotenti (uno per cliente/segnale).
 */
export async function runRiskSignalTasks(): Promise<{
  overdueTasks: number;
  churned: number;
  reactivated: number;
  slaTasks: number;
}> {
  const owners = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 20,
  });

  let overdueTasks = 0;
  let churned = 0;
  let reactivated = 0;
  let slaTasks = 0;

  for (const o of owners) {
    // 1) Finance scaduto raggruppato per cliente.
    const overdue = await prisma.financeEntry.groupBy({
      by: ["clientId"],
      where: { ownerUserId: o.id, status: "OVERDUE", clientId: { not: null } },
      _count: { _all: true },
    });

    for (const g of overdue) {
      const clientId = g.clientId;
      if (!clientId) continue;
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { companyName: true, status: true, relationshipState: true },
      });
      if (!client) continue;

      const title = `Sollecito incasso: ${client.companyName}`;
      const found = await prisma.flowTask.findFirst({
        where: { ownerUserId: o.id, source: "finance_overdue", relatedClientId: clientId, title },
        select: { id: true },
      });
      if (!found) {
        await prisma.flowTask.create({
          data: {
            ownerUserId: o.id,
            relatedClientId: clientId,
            source: "finance_overdue",
            title,
            description: `${g._count._all} voci finance scadute: contatta il cliente per l'incasso.`,
            priority: "HIGH",
          },
        });
        overdueTasks++;
      }

      // 2) Churn: cliente con 2+ insoluti → DORMANTE + task di recupero.
      if (g._count._all >= 2 && client.relationshipState === "CLIENTE") {
        // Transizione a DORMANTE: idempotente (solo se ancora attivo).
        if (client.status === "ACTIVE_CLIENT") {
          const lc = lifecycleForStatus("DORMANT");
          await prisma.client.update({
            where: { id: clientId },
            data: { status: lc.status, relationshipState: lc.relationshipState },
          });
        }
        // Task di recupero GARANTITO, disaccoppiato dalla transizione: così se la
        // create fallì a un run precedente, viene comunque ricreato (idempotente).
        const ct = `Recupero cliente a rischio: ${client.companyName}`;
        const cf = await prisma.flowTask.findFirst({
          where: { ownerUserId: o.id, source: "churn_risk", relatedClientId: clientId, title: ct },
          select: { id: true },
        });
        if (!cf) {
          await prisma.flowTask.create({
            data: {
              ownerUserId: o.id,
              relatedClientId: clientId,
              source: "churn_risk",
              title: ct,
              description: `${g._count._all} insoluti: cliente a rischio churn, definisci un piano di recupero.`,
              priority: "HIGH",
            },
          });
          churned++;
        }
      }
    }
  }

  // 2b) Riattivazione churn: un cliente DORMANTE che non ha più insoluti (sotto la
  // soglia di churn) torna ATTIVO. Prima la transizione era a senso unico: chi
  // saldava restava dormiente per sempre.
  const dormant = await prisma.client.findMany({
    where: { relationshipState: "CLIENTE", status: "DORMANT" },
    select: { id: true },
    take: 500,
  });
  if (dormant.length) {
    const dormantIds = dormant.map((c) => c.id);
    const overdueByDormant = await prisma.financeEntry.groupBy({
      by: ["clientId"],
      where: { clientId: { in: dormantIds }, status: "OVERDUE" },
      _count: { _all: true },
    });
    const overdueCount = new Map(overdueByDormant.map((g) => [g.clientId, g._count._all]));
    const toReactivate = dormant.filter((c) => (overdueCount.get(c.id) ?? 0) < 2).map((c) => c.id);
    if (toReactivate.length) {
      const lc = lifecycleForStatus("ACTIVE_CLIENT");
      const res = await prisma.client.updateMany({
        where: { id: { in: toReactivate } },
        data: { status: lc.status, relationshipState: lc.relationshipState },
      });
      reactivated = res.count;
    }
  }

  // 3) SLA ticket sforata → task urgente (una volta, assegnata al primo admin).
  const firstOwner = owners[0]?.id;
  if (firstOwner) {
    const breached = await prisma.clientTicket.findMany({
      where: { slaBreachedAt: { not: null }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, title: true, clientId: true, client: { select: { companyName: true } } },
      take: 50,
    });
    for (const t of breached) {
      const title = `SLA ticket sforata: ${t.client?.companyName ?? "cliente"} — ${t.title}`;
      const found = await prisma.flowTask.findFirst({
        where: { source: "ticket_sla", title },
        select: { id: true },
      });
      if (!found) {
        await prisma.flowTask.create({
          data: {
            ownerUserId: firstOwner,
            relatedClientId: t.clientId ?? undefined,
            source: "ticket_sla",
            title,
            description: "Ticket oltre SLA: rispondi con priorità.",
            priority: "URGENT",
          },
        });
        slaTasks++;
      }
    }
  }

  return { overdueTasks, churned, reactivated, slaTasks };
}
