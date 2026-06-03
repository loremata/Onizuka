import { dateTimeFormatIt } from "@/lib/datetime-it";
import type { FlowTask } from "@prisma/client";

export type AgendaItem = {
  id: string;
  title: string;
  dueDate: Date;
  status: FlowTask["status"];
  priority: FlowTask["priority"];
  clientId: string | null;
  clientName: string | null;
  href: string;
};

export function flowTasksToAgenda(
  tasks: {
    id: string;
    title: string;
    dueDate: Date | null;
    status: FlowTask["status"];
    priority: FlowTask["priority"];
    relatedClientId: string | null;
    client: { companyName: string } | null;
  }[]
): AgendaItem[] {
  return tasks
    .filter((t): t is typeof t & { dueDate: Date } => t.dueDate != null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      status: t.status,
      priority: t.priority,
      clientId: t.relatedClientId,
      clientName: t.client?.companyName ?? null,
      href: t.relatedClientId
        ? `/admin/flow?clientId=${encodeURIComponent(t.relatedClientId)}`
        : "/admin/flow",
    }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export function groupAgendaByDay(
  items: AgendaItem[],
  timeZone?: string | null
): { key: string; label: string; items: AgendaItem[] }[] {
  const fmt = dateTimeFormatIt({
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });

  const map = new Map<string, { label: string; items: AgendaItem[] }>();
  for (const item of items) {
    const key = dayKeyFmt.format(item.dueDate);
    if (!map.has(key)) {
      map.set(key, { label: fmt.format(item.dueDate), items: [] });
    }
    map.get(key)!.items.push(item);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, label: v.label, items: v.items }));
}
