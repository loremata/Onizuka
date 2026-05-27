import { prisma } from "@/lib/prisma";

const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "WAITING"] as const;

export type FlowReminderResult = {
  dueToday: number;
  overdue: number;
  skipped: number;
};

type FlowTaskReminderInput = {
  id: string;
  title: string;
  dueDate: Date | null;
  ownerUserId: string;
  client?: { companyName: string } | null;
};

async function alreadyRemindedToday(
  userId: string,
  kind: string,
  taskId: string,
  dayStart: Date
): Promise<boolean> {
  const existing = await prisma.userNotification.findFirst({
    where: {
      userId,
      kind,
      body: { contains: taskId },
      createdAt: { gte: dayStart },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function createFlowReminder(
  task: FlowTaskReminderInput,
  dayStart: Date,
  dayEnd: Date
): Promise<"due_today" | "overdue" | "skipped" | "none"> {
  if (!task.dueDate) return "none";

  const isOverdue = task.dueDate < dayStart;
  const isDueToday = !isOverdue && task.dueDate >= dayStart && task.dueDate <= dayEnd;
  if (!isOverdue && !isDueToday) return "none";

  const kind = isOverdue ? "flow_overdue_reminder" : "flow_due_today";
  if (await alreadyRemindedToday(task.ownerUserId, kind, task.id, dayStart)) {
    return "skipped";
  }

  const clientSuffix = task.client ? ` · ${task.client.companyName}` : "";
  const title = isOverdue ? `Task in ritardo · ${task.title}` : `Scadenza oggi · ${task.title}`;

  await prisma.userNotification.create({
    data: {
      userId: task.ownerUserId,
      kind,
      title,
      body: `task:${task.id}${clientSuffix}`,
      href: "/admin/flow",
    },
  });

  return isOverdue ? "overdue" : "due_today";
}

/** Promemoria immediato alla creazione/aggiornamento se la scadenza è oggi o passata. */
export async function notifyFlowTaskReminderIfNeeded(
  task: FlowTaskReminderInput,
  dayStart: Date,
  dayEnd: Date
): Promise<void> {
  await createFlowReminder(task, dayStart, dayEnd);
}

/**
 * In-app reminders for open Flow tasks due today or overdue (once per task per day).
 */
export async function runFlowDueReminders(dayStart: Date, dayEnd: Date): Promise<FlowReminderResult> {
  const tasks = await prisma.flowTask.findMany({
    where: {
      status: { in: [...OPEN_STATUSES] },
      dueDate: { not: null, lte: dayEnd },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      ownerUserId: true,
      client: { select: { companyName: true } },
    },
  });

  let dueToday = 0;
  let overdue = 0;
  let skipped = 0;

  for (const task of tasks) {
    const result = await createFlowReminder(task, dayStart, dayEnd);
    if (result === "due_today") dueToday += 1;
    else if (result === "overdue") overdue += 1;
    else if (result === "skipped") skipped += 1;
  }

  return { dueToday, overdue, skipped };
}
