import type { FlowTaskStatus, Prisma } from "@prisma/client";
import { normalizeQueryParam } from "@/lib/opportunity-list-filters";

const Q_MAX = 200;

const FLOW_STATUSES: FlowTaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"];

export type FlowDueFilter = "today" | "overdue";

export type FlowTaskListFilters = {
  q: string;
  status: FlowTaskStatus | null;
  clientId: string;
  due: FlowDueFilter | null;
  source: string;
};

export type FlowDueBounds = {
  dayStart: Date;
  dayEnd: Date;
};

export function parseFlowTaskListFilters(
  searchParams: Record<string, string | string[] | undefined>
): FlowTaskListFilters {
  let q = normalizeQueryParam(searchParams.q);
  if (q.length > Q_MAX) q = q.slice(0, Q_MAX);
  const statusRaw = normalizeQueryParam(searchParams.status);
  const status = FLOW_STATUSES.includes(statusRaw as FlowTaskStatus) ? (statusRaw as FlowTaskStatus) : null;
  const clientId = normalizeQueryParam(searchParams.clientId);
  const dueRaw = normalizeQueryParam(searchParams.due);
  const due: FlowDueFilter | null = dueRaw === "today" || dueRaw === "overdue" ? dueRaw : null;
  const source = normalizeQueryParam(searchParams.source);
  return { q, status, clientId, due, source };
}

const OPEN_STATUSES: FlowTaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING"];

export function buildOwnedFlowTaskWhere(
  ownerUserId: string,
  f: FlowTaskListFilters,
  dueBounds?: FlowDueBounds
): Prisma.FlowTaskWhereInput {
  const mode = "insensitive" as const;

  let dueClause: Prisma.FlowTaskWhereInput = {};
  if (f.due === "today" && dueBounds) {
    dueClause = {
      status: { in: OPEN_STATUSES },
      dueDate: { gte: dueBounds.dayStart, lte: dueBounds.dayEnd },
    };
  } else if (f.due === "overdue" && dueBounds) {
    dueClause = {
      status: { in: OPEN_STATUSES },
      dueDate: { lt: dueBounds.dayStart },
    };
  }

  return {
    ownerUserId,
    ...(f.clientId ? { clientId: f.clientId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.source ? { source: f.source } : {}),
    ...dueClause,
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode } },
            { description: { contains: f.q, mode } },
            { source: { contains: f.q, mode } },
            { client: { is: { OR: [{ companyName: { contains: f.q, mode } }, { slug: { contains: f.q, mode } }] } } },
          ],
        }
      : {}),
  };
}
