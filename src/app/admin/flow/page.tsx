import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidIanaTimeZone, resolveRecapDayBounds } from "@/lib/day-bounds";
import { buildOwnedFlowTaskWhere, parseFlowTaskListFilters } from "@/lib/flow-task-list-filters";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { FlowTaskForm } from "./flow-task-form";
import { FlowTaskDeleteButton } from "./flow-task-delete-button";
import { ClientLink } from "@/components/onizuka/client-link";
import { FlowTaskDueForm } from "./flow-task-due-form";
import { FlowTaskStatusForm } from "./flow-task-status-form";

const statusFilterLabels: Record<string, string> = {
  TODO: "Da fare",
  IN_PROGRESS: "In corso",
  WAITING: "In attesa",
  DONE: "Completato",
  CANCELLED: "Annullato",
};

const statusFilterOptions = ["TODO", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"] as const;

const priorityLabel: Record<string, string> = {
  LOW: "Bassa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function formatDue(d: Date | null, userTimeZone?: string | null) {
  if (!d) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "short",
    timeStyle: "short",
  };
  const tz = userTimeZone?.trim();
  if (tz && isValidIanaTimeZone(tz)) {
    opts.timeZone = tz;
  }
  return dateTimeFormatIt(opts).format(d);
}

const statusOrder: Record<string, number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  WAITING: 2,
  DONE: 3,
  CANCELLED: 4,
};

const openStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const;

export default async function AdminFlowPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const listFilters = parseFlowTaskListFilters(searchParams);

  const { start: dayStart, end: dayEnd, timeZoneLabel } = resolveRecapDayBounds({
    userTimeZone: session.user.timeZone,
  });
  const userTz = session.user.timeZone;
  const dueBounds = { dayStart, dayEnd };

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.flowTask.findMany({
        where: buildOwnedFlowTaskWhere(session.user.id, listFilters, dueBounds),
        include: { client: { select: { id: true, companyName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.findMany({
        orderBy: { companyName: "asc" },
        select: { id: true, companyName: true },
      }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Flow</h1>
          <p className="text-muted-foreground">Task operativi personali e collegati al CRM.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [tasks, clients] = loaded.data;

  const sorted = [...tasks].sort((a, b) => {
    const s = statusOrder[a.status] - statusOrder[b.status];
    if (s !== 0) return s;
    const ad = a.dueDate?.getTime() ?? Infinity;
    const bd = b.dueDate?.getTime() ?? Infinity;
    return ad - bd;
  });

  const dueToday = sorted.filter(
    (t) =>
      openStatuses.includes(t.status as (typeof openStatuses)[number]) &&
      t.dueDate != null &&
      t.dueDate >= dayStart &&
      t.dueDate <= dayEnd
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Onizuka Flow</h1>
        <p className="text-muted-foreground">
          Task operativi personali e collegati al CRM. Filtri opzionali su testo e stato (query GET). MVP 1: creazione
          e aggiornamento stato.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>
            Ricerca in titolo, descrizione, origine e cliente. Scadenza: oggi o in ritardo (solo task ancora aperti).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Testo
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={listFilters.q}
                placeholder="Cerca…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[180px] flex-col gap-1">
              <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
                Cliente
              </label>
              <select
                id="clientId"
                name="clientId"
                defaultValue={listFilters.clientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[140px] flex-col gap-1">
              <label htmlFor="due" className="text-xs font-medium text-muted-foreground">
                Scadenza
              </label>
              <select
                id="due"
                name="due"
                defaultValue={listFilters.due ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutte</option>
                <option value="today">Oggi</option>
                <option value="overdue">In ritardo</option>
              </select>
            </div>
            <div className="flex min-w-[180px] flex-col gap-1">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                Stato
              </label>
              <select
                id="status"
                name="status"
                defaultValue={listFilters.status ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {statusFilterOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusFilterLabels[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/flow">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scadenze oggi</CardTitle>
          <CardDescription>
            Task ancora aperti con scadenza nel giorno civile corrente (stesso fuso del Command Center:{" "}
            <span className="text-foreground">{timeZoneLabel}</span>).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {dueToday.length === 0 ? (
            <p className="text-muted-foreground">Nessun task aperto con scadenza oggi.</p>
          ) : (
            <ul className="space-y-2">
              {dueToday.map((t) => (
                <li key={t.id}>
                  <span className="font-medium">{t.title}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {priorityLabel[t.priority] ?? t.priority} · {formatDue(t.dueDate, userTz)}
                    {t.client ? (
                      <>
                        {" "}
                        · <ClientLink clientId={t.client.id} name={t.client.companyName} className="font-normal" />
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuovo task</CardTitle>
          <CardDescription>Aggiungi un&apos;attività con priorità, scadenza e cliente opzionale.</CardDescription>
        </CardHeader>
        <CardContent>
          <FlowTaskForm
            clients={clients}
            dueDateCaption={`Data e ora sono lette come orologio civile in «${timeZoneLabel}» (stesso criterio del Command Center).`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>I tuoi task</CardTitle>
          <CardDescription>
            {sorted.length === 0
              ? listFilters.q || listFilters.status || listFilters.clientId || listFilters.due
                ? "Nessun task con questi filtri."
                : "Nessun task ancora. Creane uno sopra o esegui il seed."
              : `${sorted.length} task in elenco.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Titolo</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Priorità</th>
                <th className="pb-2 pr-4 font-medium">Scadenza</th>
                <th className="pb-2 pr-4 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 align-top">
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    {t.client ? (
                      <Link href={`/admin/clients/${t.client.id}`} className="text-primary hover:underline">
                        {t.client.companyName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4 align-top">{priorityLabel[t.priority] ?? t.priority}</td>
                  <td className="py-3 pr-4 align-top">
                    <FlowTaskDueForm taskId={t.id} dueDate={t.dueDate} />
                  </td>
                  <td className="py-3 align-top">
                    <div className="flex flex-col items-end gap-1">
                      <FlowTaskStatusForm taskId={t.id} current={t.status} />
                      <FlowTaskDeleteButton taskId={t.id} title={t.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
