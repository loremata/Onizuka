import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { loadAdminDashboardStats } from "@/lib/admin-dashboard-stats";
import { loadAdminKpiTrends } from "@/lib/admin-kpi-trends";
import { loadCommandCenterPriorities } from "@/lib/command-center-priorities";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { askIntentLabel } from "@/lib/ask-onizuka";
import { orchestrateAsk } from "@/lib/ask-orchestration";
import { countApprovalQueuePending } from "@/lib/approval-queue";
import { CommandCenterQuickLinks } from "@/components/onizuka/command-center-quick-links";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { KpiTrendBars } from "@/components/onizuka/kpi-trend-bars";
import { AdminProductionAlert } from "@/components/onizuka/admin-production-alert";
import { CrmOpsPanel } from "@/components/onizuka/crm-ops-panel";
import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";
import { getDormantClients } from "@/lib/dormant-reactivation";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminDashboardPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const askRaw = searchParams.ask;
  const ask = typeof askRaw === "string" ? askRaw.trim() : undefined;
  const askPlan = ask ? orchestrateAsk(ask) : null;
  const askIntent = askPlan?.primary ?? null;

  if (ask && askIntent?.kind === "navigate") {
    redirect(askIntent.href);
  }

  const { start: dayStart, end: dayEnd, timeZoneLabel } = resolveRecapDayBounds({
    userTimeZone: session.user.timeZone,
  });
  const ownerId = session.user.id;
  const [dashboard, trends, priorities, bottlenecks, dormant, approvalPending] = await Promise.all([
    loadAdminDashboardStats(ownerId, dayStart, dayEnd),
    loadAdminKpiTrends(ownerId),
    loadCommandCenterPriorities(ownerId, session.user.timeZone),
    getLeadPipelineBottlenecks(ownerId, 5),
    getDormantClients(ownerId, 5),
    countApprovalQueuePending(ownerId),
  ]);

  if (!dashboard.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Command Center</h1>
          <p className="onizuka-page-lead">
            Centro operativo Onizuka: clienti, task, approvazioni e automazioni.
          </p>
        </div>
        <DbUnavailableBanner />
        <Card>
          <CardHeader>
            <CardTitle>Azioni rapide</CardTitle>
            <CardDescription>Disponibili quando il database è attivo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/admin/settings">Impostazioni</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/search">Ricerca globale</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    pendingPosts,
    flowOpen,
    clientsCount,
    memoryCount,
    tasksDueToday,
    tasksOverdue,
    urgentOpen,
    recentMemories,
    dormantClients,
    opportunitiesOpen,
    leadsNew,
    openTickets,
    quotesDraft,
    pipelineWeightedEur,
  } = dashboard.stats;

  const priorityLabel: Record<string, string> = {
    LOW: "Bassa",
    MEDIUM: "Media",
    HIGH: "Alta",
    URGENT: "Urgente",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Command Center</h1>
        <p className="onizuka-page-lead">
          Centro operativo Onizuka: clienti, task, approvazioni e automazioni.
        </p>
      </div>

      <AdminProductionAlert />

      <CommandCenterQuickLinks approvalPending={approvalPending} pendingPosts={pendingPosts} />

      <CrmOpsPanel bottlenecks={bottlenecks} dormant={dormant} />

      {priorities.length > 0 ? (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Priorità strategiche oggi</CardTitle>
            <CardDescription>Top 3 azioni consigliate da Insights, Finance e upsell CRM.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {priorities.map((p, i) => (
                <li key={p.id} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <Link className="font-medium text-primary hover:underline" href={p.href}>
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{p.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Button asChild variant="link" className="mt-2 h-auto px-0 text-xs">
              <Link href="/admin/insights">Tutti i suggerimenti</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {ask && askPlan && askIntent && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comando ricevuto</CardTitle>
            <CardDescription>{askPlan.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-foreground">{ask}</blockquote>
              <Button asChild size="sm" variant="secondary" className="shrink-0">
                <Link href={askPlan.primaryHref}>{askIntentLabel(askIntent)} →</Link>
              </Button>
            </div>
            {askPlan.followUps.length > 0 ? (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Prossimi passi:</span>
                {askPlan.followUps.map((f) => (
                  <Link key={f.href} href={f.href} className="text-primary hover:underline">
                    {f.label}
                  </Link>
                ))}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recap di oggi</CardTitle>
          <CardDescription>
            Sintesi operativa: il giorno «oggi» per task in scadenza segue «{timeZoneLabel}». Ordine: profilo utente in{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/settings">
              Impostazioni
            </Link>{" "}
            → <span className="font-mono">ONIZUKA_RECAP_TIMEZONE</span> → server locale. Recap vocale in{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href="/admin/voice">
              Onizuka Voice
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Task e urgenze</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                Task aperti totali:{" "}
                <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/admin/flow">
                  {flowOpen}
                </Link>
              </li>
              <li>
                Task urgenti ancora aperti:{" "}
                <span className={urgentOpen > 0 ? "font-medium text-amber-500" : "text-foreground"}>{urgentOpen}</span>
              </li>
              <li>
                Task in ritardo (scadenza prima di oggi):{" "}
                <span className={tasksOverdue > 0 ? "font-medium text-destructive" : "text-foreground"}>
                  {tasksOverdue}
                </span>
              </li>
              <li>Clienti in stato &quot;Dormiente&quot;: {dormantClients}</li>
              <li>
                Opportunità CRM aperte (tue):{" "}
                <Link
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  href="/admin/crm/pipeline"
                >
                  {opportunitiesOpen}
                </Link>
              </li>
            </ul>
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">In scadenza oggi</p>
              {tasksDueToday.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessun task con scadenza oggi.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {tasksDueToday.map((t) => (
                    <li key={t.id}>
                      <span className="text-foreground">{t.title}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {priorityLabel[t.priority] ?? t.priority}
                        {t.client ? ` · ${t.client.companyName}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenuti e memoria</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                Post in attesa di approvazione:{" "}
                <Link
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  href="/admin/posts?status=PENDING"
                >
                  {pendingPosts}
                </Link>
              </li>
              <li>Voci di memoria salvate: {memoryCount}</li>
            </ul>
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">Memoria aggiornata di recente</p>
              {recentMemories.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nessuna voce ancora.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {recentMemories.map((m) => (
                    <li key={m.id}>
                      <Link className="text-primary hover:underline" href={`/admin/memory/${m.id}/edit`}>
                        {m.title}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {new Intl.DateTimeFormat("it-IT", { dateStyle: "short" }).format(m.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trend ultimi 7 giorni</CardTitle>
          <CardDescription>Lead creati, opportunità vinte e post in coda (PENDING).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3 text-sm">
          {(
            [
              ["Lead", trends.leadsLast7Days],
              ["Opportunità vinte", trends.opportunitiesWonLast7Days],
              ["Post in coda", trends.postsPendingLast7Days],
            ] as const
          ).map(([label, buckets]) => (
            <div key={label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <KpiTrendBars buckets={buckets} maxBarHeight={48} />
              <ul className="mt-2 flex flex-wrap gap-2">
                {buckets.map((d) => (
                  <li key={d.day} className="rounded-md border border-border/50 px-2 py-1 text-xs">
                    <span className="text-muted-foreground">{d.label}</span>{" "}
                    <span className="font-semibold tabular-nums">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline pesata</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">€ {pipelineWeightedEur}</p>
            <p className="text-xs text-muted-foreground">{opportunitiesOpen} opportunità aperte</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lead attivi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{leadsNew}</p>
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href="/admin/crm/leads">Vedi lead</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket aperti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openTickets}</p>
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href="/admin/client-portal/tickets">Gestione ticket</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Preventivi bozza</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{quotesDraft}</p>
            <Button asChild variant="link" className="h-auto p-0 text-xs">
              <Link href="/admin/crm/opportunities">Opportunità</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CRM</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{clientsCount}</p>
            <p className="text-xs text-muted-foreground">Clienti in anagrafica</p>
            <p className="mt-3 text-xs text-muted-foreground">
              Opportunità aperte:{" "}
              <Link
                className="font-semibold text-foreground tabular-nums underline-offset-4 hover:underline"
                href="/admin/crm/pipeline"
              >
                {opportunitiesOpen}
              </Link>
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/clients">Apri clienti</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href="/admin/crm/pipeline">Pipeline CRM</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{flowOpen}</p>
            <p className="text-xs text-muted-foreground">Task aperti (da fare / in corso / in attesa)</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/flow">Apri Flow</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href="/admin/calendar">Calendario</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memoria</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{memoryCount}</p>
            <p className="text-xs text-muted-foreground">Voci di memoria salvate</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/memory">Apri memoria</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contenuti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingPosts}</p>
            <p className="text-xs text-muted-foreground">Post in attesa di approvazione</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/posts?status=PENDING">Vedi in coda</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automazioni</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
            <p className="text-xs text-muted-foreground">Webhook verso n8n</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/admin/webhooks">Gestisci</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Azioni rapide</CardTitle>
          <CardDescription>MVP 1: struttura modulare pronta per Audit, Reach, Finance e Voice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/flow">Nuovo task in Flow</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/clients">Clienti</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/pipeline">Pipeline CRM</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/opportunities">Opportunità</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/leads">Lead</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/regia-operativa">Regia operativa</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/walkin">Walk-in pubblico</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/users">Utenti</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/posts">Contenuti</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/webhooks">Automazioni</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/search">Ricerca globale</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/memory/new">Nuova memoria</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
