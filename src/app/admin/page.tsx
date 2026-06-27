import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdminArea } from "@/lib/admin-session";
import { loadAdminDashboardStats } from "@/lib/admin-dashboard-stats";
import { loadAdminKpiTrends } from "@/lib/admin-kpi-trends";
import { loadActionInbox } from "@/lib/action-inbox";
import { ActionInboxCard } from "@/components/onizuka/action-inbox-card";
import { resolveRecapDayBounds } from "@/lib/day-bounds";
import { askIntentLabel } from "@/lib/ask-onizuka";
import { orchestrateAsk } from "@/lib/ask-orchestration";
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

  const { start: dayStart, end: dayEnd } = resolveRecapDayBounds({
    userTimeZone: session.user.timeZone,
  });
  const ownerId = session.user.id;
  const [dashboard, trends, inbox, bottlenecks, dormant] = await Promise.all([
    loadAdminDashboardStats(ownerId, dayStart, dayEnd),
    loadAdminKpiTrends(ownerId),
    loadActionInbox(ownerId, 100),
    getLeadPipelineBottlenecks(ownerId, 5),
    getDormantClients(ownerId, 5),
  ]);

  if (!dashboard.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Oggi</h1>
          <p className="onizuka-page-lead">Centro operativo Onizuka.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const {
    pendingPosts,
    flowOpen,
    clientsCount,
    opportunitiesOpen,
    leadsNew,
    openTickets,
    quotesDraft,
    pipelineWeightedEur,
  } = dashboard.stats;

  // Striscia KPI: ogni numero compare UNA volta sola, cliccabile.
  const kpis: { label: string; value: string | number; href: string }[] = [
    { label: "Pipeline pesata", value: `€ ${pipelineWeightedEur}`, href: "/admin/crm/pipeline" },
    { label: "Opportunità aperte", value: opportunitiesOpen, href: "/admin/crm/pipeline" },
    { label: "Lead attivi", value: leadsNew, href: "/admin/crm/leads" },
    { label: "Preventivi bozza", value: quotesDraft, href: "/admin/crm/opportunities" },
    { label: "Ticket aperti", value: openTickets, href: "/admin/client-portal/tickets" },
    { label: "Task aperti", value: flowOpen, href: "/admin/flow" },
    { label: "Post in coda", value: pendingPosts, href: "/admin/posts?status=PENDING" },
    { label: "Clienti", value: clientsCount, href: "/admin/clients" },
  ];

  const createActions: { label: string; href: string; primary?: boolean }[] = [
    { label: "Nuovo task", href: "/admin/flow", primary: true },
    { label: "Nuovo cliente", href: "/admin/clients/new" },
    { label: "Audit digitale", href: "/admin/audit/digital" },
    { label: "Nuova memoria", href: "/admin/memory/new" },
    { label: "Ricerca globale", href: "/admin/search" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Oggi</h1>
        <p className="onizuka-page-lead">Cosa fare ora, i numeri chiave e i segnali da gestire.</p>
      </div>

      <AdminProductionAlert />

      {ask && askPlan && askIntent ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comando ricevuto</CardTitle>
            <CardDescription>{askPlan.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-foreground">{ask}</blockquote>
              <Button asChild size="sm" variant="secondary" className="shrink-0">
                <Link href={askPlan.primaryHref}>{askIntentLabel(askIntent)} →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 1 · Cosa fare oggi — l'unica lista azionabile */}
      <ActionInboxCard items={inbox} />

      {/* 2 · KPI chiave — ogni numero una sola volta */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-lg border border-border/80 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{k.value}</p>
          </Link>
        ))}
      </div>

      {/* 3 · Segnali CRM da gestire (colli di bottiglia + dormienti) */}
      <CrmOpsPanel bottlenecks={bottlenecks} dormant={dormant} />

      {/* 4 · Trend 7 giorni (sintesi, non duplicata altrove) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trend ultimi 7 giorni</CardTitle>
          <CardDescription>Lead creati, opportunità vinte e post in coda.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 text-sm lg:grid-cols-3">
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
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 5 · Azioni "crea" — la navigazione è gia' nella barra in alto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Azioni rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {createActions.map((a) => (
            <Button key={a.href} asChild variant={a.primary ? "default" : "outline"} size="sm">
              <Link href={a.href}>{a.label}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
