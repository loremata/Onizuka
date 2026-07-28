import { prisma } from "@/lib/prisma";

const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "WAITING"] as const;

/**
 * PROMEMORIA TASK — ripensati il 28/07 dopo aver misurato 40.622 notifiche
 * tutte non lette, di cui 37.530 di un solo tipo.
 *
 * Il difetto era nella regola: "un promemoria per task AL GIORNO". Con 2.755
 * task in ritardo significa 2.755 notifiche ogni giorno, per sempre — e in
 * mezzo a quelle spariscono le poche che contano davvero (gli SLA delle
 * opportunità erano 388 su 40.622). Una notifica che si ripete ogni giorno non
 * è un promemoria: è rumore che seppellisce il segnale.
 *
 * Due regole nuove:
 *  1. un task in ritardo avvisa UNA volta, poi al massimo una volta al mese.
 *     Il ritardo non è una notizia nuova ogni mattina: la lista dei task è lì.
 *  2. oltre una manciata di task, si manda UN riepilogo invece di N notifiche.
 *     "Hai 2.755 task in ritardo" è utile; 2.755 messaggi separati no.
 */

/** Oltre questo numero di task da segnalare, si manda un solo riepilogo. */
const MAX_INDIVIDUAL_REMINDERS = 15;
/** Un task già segnalato in ritardo non torna a farlo prima di questi giorni. */
const OVERDUE_REMINDER_COOLDOWN_DAYS = 30;

export type FlowReminderResult = {
  dueToday: number;
  overdue: number;
  skipped: number;
  /** Valorizzato quando si è mandato un riepilogo al posto delle singole. */
  digest?: { overdue: number; dueToday: number };
};

type FlowTaskReminderInput = {
  id: string;
  title: string;
  dueDate: Date | null;
  ownerUserId: string;
  client?: { companyName: string } | null;
};

/**
 * "Già avvisato?" — con finestra diversa per i due casi: la scadenza di oggi è
 * un fatto del giorno, il ritardo è uno stato che dura.
 */
async function alreadyReminded(
  userId: string,
  kind: string,
  taskId: string,
  dayStart: Date
): Promise<boolean> {
  const since =
    kind === "flow_overdue_reminder"
      ? new Date(dayStart.getTime() - OVERDUE_REMINDER_COOLDOWN_DAYS * 86_400_000)
      : dayStart;
  const existing = await prisma.userNotification.findFirst({
    where: { userId, kind, body: { contains: taskId }, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(existing);
}

type Classified = { kind: "flow_overdue_reminder" | "flow_due_today"; task: FlowTaskReminderInput };

function classify(task: FlowTaskReminderInput, dayStart: Date, dayEnd: Date): Classified | null {
  if (!task.dueDate) return null;
  const isOverdue = task.dueDate < dayStart;
  const isDueToday = !isOverdue && task.dueDate >= dayStart && task.dueDate <= dayEnd;
  if (!isOverdue && !isDueToday) return null;
  return { kind: isOverdue ? "flow_overdue_reminder" : "flow_due_today", task };
}

async function writeReminder(c: Classified): Promise<void> {
  const isOverdue = c.kind === "flow_overdue_reminder";
  const clientSuffix = c.task.client ? ` · ${c.task.client.companyName}` : "";
  await prisma.userNotification.create({
    data: {
      userId: c.task.ownerUserId,
      kind: c.kind,
      title: isOverdue ? `Task in ritardo · ${c.task.title}` : `Scadenza oggi · ${c.task.title}`,
      body: `task:${c.task.id}${clientSuffix}`,
      href: "/admin/flow",
    },
  });
}

/** Promemoria immediato alla creazione/aggiornamento se la scadenza è oggi o passata. */
export async function notifyFlowTaskReminderIfNeeded(
  task: FlowTaskReminderInput,
  dayStart: Date,
  dayEnd: Date
): Promise<void> {
  const c = classify(task, dayStart, dayEnd);
  if (!c) return;
  if (await alreadyReminded(task.ownerUserId, c.kind, task.id, dayStart)) return;
  await writeReminder(c);
}

/**
 * Promemoria per i task aperti scaduti o in scadenza oggi. Oltre la soglia
 * manda un riepilogo per proprietario invece di una notifica per task.
 */
export async function runFlowDueReminders(dayStart: Date, dayEnd: Date): Promise<FlowReminderResult> {
  const tasks = await prisma.flowTask.findMany({
    where: { status: { in: [...OPEN_STATUSES] }, dueDate: { not: null, lte: dayEnd } },
    select: {
      id: true,
      title: true,
      dueDate: true,
      ownerUserId: true,
      client: { select: { companyName: true } },
    },
  });

  const candidates = tasks
    .map((t) => classify(t, dayStart, dayEnd))
    .filter((c): c is Classified => c !== null);

  let dueToday = 0;
  let overdue = 0;
  let skipped = 0;

  // Da avvisare = non già avvisati nella rispettiva finestra.
  const toNotify: Classified[] = [];
  for (const c of candidates) {
    if (await alreadyReminded(c.task.ownerUserId, c.kind, c.task.id, dayStart)) {
      skipped += 1;
      continue;
    }
    toNotify.push(c);
  }

  if (toNotify.length === 0) return { dueToday: 0, overdue: 0, skipped };

  // Pochi: una notifica ciascuna, con il titolo del task — è azionabile.
  if (toNotify.length <= MAX_INDIVIDUAL_REMINDERS) {
    for (const c of toNotify) {
      await writeReminder(c);
      if (c.kind === "flow_overdue_reminder") overdue += 1;
      else dueToday += 1;
    }
    return { dueToday, overdue, skipped };
  }

  // Tanti: un riepilogo per proprietario. Elencarli tutti non aiuterebbe
  // nessuno e renderebbe illeggibile la campanella.
  const byOwner = new Map<string, Classified[]>();
  for (const c of toNotify) {
    const arr = byOwner.get(c.task.ownerUserId) ?? [];
    arr.push(c);
    byOwner.set(c.task.ownerUserId, arr);
  }

  let digestOverdue = 0;
  let digestDueToday = 0;
  for (const [userId, items] of Array.from(byOwner.entries())) {
    const nOverdue = items.filter((i: Classified) => i.kind === "flow_overdue_reminder").length;
    const nDue = items.length - nOverdue;
    digestOverdue += nOverdue;
    digestDueToday += nDue;
    const parts = [
      nOverdue ? `${nOverdue} in ritardo` : null,
      nDue ? `${nDue} in scadenza oggi` : null,
    ].filter(Boolean);
    await prisma.userNotification.create({
      data: {
        userId,
        kind: "flow_digest",
        title: `Task da gestire: ${parts.join(", ")}`,
        body: `Troppi per elencarli uno a uno. Apri la lista per lavorarli o chiuderli.`,
        href: "/admin/flow",
      },
    });
  }

  return { dueToday: 0, overdue: 0, skipped, digest: { overdue: digestOverdue, dueToday: digestDueToday } };
}

/**
 * Retention delle notifiche. I promemoria dei task sono per definizione
 * effimeri: la verità è la lista dei task, non la loro eco. Il resto resta
 * più a lungo perché racconta cosa è successo.
 */
export async function purgeOldNotifications(now = new Date()): Promise<number> {
  const EPHEMERAL = ["flow_overdue_reminder", "flow_due_today", "flow_digest"];
  const [ephemeral, rest] = await Promise.all([
    prisma.userNotification.deleteMany({
      where: { kind: { in: EPHEMERAL }, createdAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
    }),
    prisma.userNotification.deleteMany({
      where: { kind: { notIn: EPHEMERAL }, createdAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } },
    }),
  ]);
  return ephemeral.count + rest.count;
}
