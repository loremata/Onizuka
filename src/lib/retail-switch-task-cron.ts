import { prisma } from "@/lib/prisma";
import { loadUpcomingRetailSwitchReminders } from "@/lib/retail-switch-reminders";

const SOURCE = "retail_switch_reminder";

/**
 * Trasforma i reminder "cambio compagnia" GIÀ proponibili in FlowTask azionabili.
 * Prima il reminder era calcolato ma non lo consumava nessuno (flusso orfano):
 * ora ogni contratto proponibile genera un task sul cliente, una sola volta.
 */
export async function runRetailSwitchTaskGeneration(): Promise<{
  owners: number;
  created: number;
  existing: number;
}> {
  const owners = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 20,
  });

  let created = 0;
  let existing = 0;

  for (const o of owners) {
    // withinDays=0 → solo i contratti con switchReminderAt già passato (proponibili ORA).
    const due = await loadUpcomingRetailSwitchReminders(o.id, 0);
    for (const r of due) {
      const title = `Cambio compagnia proponibile: ${r.clientName} · ${r.label}`;
      // Idempotente: un solo task per (cliente, contratto), a prescindere dallo stato.
      const found = await prisma.flowTask.findFirst({
        where: { ownerUserId: o.id, source: SOURCE, relatedClientId: r.clientId, title },
        select: { id: true },
      });
      if (found) {
        existing++;
        continue;
      }
      await prisma.flowTask.create({
        data: {
          ownerUserId: o.id,
          relatedClientId: r.clientId,
          source: SOURCE,
          title,
          description: `Contratto ${r.kind}${r.operator ? ` (${r.operator})` : ""} a €${r.monthlyEur}/mese: è il momento di riproporre un cambio operatore e ri-guadagnare sullo stesso cliente.`,
          priority: "MEDIUM",
        },
      });
      created++;
    }
  }

  return { owners: owners.length, created, existing };
}
