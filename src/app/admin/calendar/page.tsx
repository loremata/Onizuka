import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { flowTasksToAgenda, groupAgendaByDay } from "@/lib/calendar-agenda";
import { isValidIanaTimeZone, resolveRecapDayBounds } from "@/lib/day-bounds";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { GoogleCalendarEventsCard } from "@/components/onizuka/google-calendar-events";

const priorityLabel: Record<string, string> = {
  LOW: "Bassa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const statusLabel: Record<string, string> = {
  TODO: "Da fare",
  IN_PROGRESS: "In corso",
  WAITING: "In attesa",
  DONE: "Completato",
  CANCELLED: "Annullato",
};

export default async function AdminCalendarPage() {
  const session = await requireAdminArea();

  const ownerId = session.user.id;
  const userTz = session.user.timeZone;
  const { end: dayEnd, timeZoneLabel } = resolveRecapDayBounds({ userTimeZone: userTz });

  const horizon = new Date(dayEnd);
  horizon.setDate(horizon.getDate() + 14);

  const openStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const;

  const loaded = await runWithDb(() =>
    prisma.flowTask.findMany({
      where: {
        ownerUserId: ownerId,
        status: { in: [...openStatuses] },
        dueDate: { lte: horizon, not: null },
      },
      orderBy: { dueDate: "asc" },
      take: 80,
      include: { client: { select: { companyName: true } } },
    })
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Calendario operativo</h1>
          <p className="text-muted-foreground">Agenda da task Flow (MVP).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const agenda = flowTasksToAgenda(loaded.data);
  const tz = userTz && isValidIanaTimeZone(userTz) ? userTz : undefined;
  const grouped = groupAgendaByDay(agenda, tz);
  const timeFmt = dateTimeFormatIt({
    hour: "2-digit",
    minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="onizuka-page-title">Calendario operativo</h1>
          <p className="text-muted-foreground">
            Agenda da task Flow (14 giorni). Esporta ICS per Google/Outlook. Fuso: {timeZoneLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/calendar/ics">Esporta ICS</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/flow">Apri Flow</Link>
          </Button>
        </div>
      </div>

      <GoogleCalendarEventsCard />

      {grouped.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nessuna scadenza in agenda</CardTitle>
            <CardDescription>
              Crea task in Flow con data di scadenza oppure usa{" "}
              <Link className="text-primary underline-offset-4 hover:underline" href="/admin/flow?due=today">
                scadenze oggi
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        grouped.map((day) => (
          <Card key={day.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize">{day.label}</CardTitle>
              <CardDescription>{day.items.length} task</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {day.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <span className="font-mono text-xs text-muted-foreground">{timeFmt.format(item.dueDate)}</span>
                    <Link className="font-medium text-primary hover:underline" href={item.href}>
                      {item.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {statusLabel[item.status]} · {priorityLabel[item.priority]}
                      {item.clientName ? ` · ${item.clientName}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
