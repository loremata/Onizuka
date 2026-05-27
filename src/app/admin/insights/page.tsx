import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadInsightsStats } from "@/lib/insights-stats";
import { buildInsightRecommendations } from "@/lib/insights-recommendations";
import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";
import { buildFinanceReconciliationRecommendations } from "@/lib/finance-reconciliation-insights";
import { loadOwnerPipelineForecast } from "@/lib/insights-pipeline-forecast";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { digestEmailEnabled } from "@/lib/notification-digest";
import { InsightsOpsDigestToolbar } from "./insights-ops-digest-toolbar";
import { loadTopClientsByServiceGaps } from "@/lib/insights-service-graph";

export default async function AdminInsightsPage() {
  const session = await requireAdminArea();

  const [result, financeRecon, pipeline, upsellClients] = await Promise.all([
    loadInsightsStats(session.user.id, session.user.timeZone),
    loadFinanceReconciliation(session.user.id),
    loadOwnerPipelineForecast(session.user.id),
    loadTopClientsByServiceGaps(8),
  ]);

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Insights</h1>
          <p className="text-muted-foreground">KPI operativi e alert del giorno (MVP).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const s = result.stats;
  const recommendations = [
    ...buildInsightRecommendations(s),
    ...(financeRecon.ok
      ? buildFinanceReconciliationRecommendations(financeRecon.report)
      : []),
  ];
  const alerts: { label: string; href: string; severity: "warn" | "info" }[] = [];

  if (s.flowOverdue > 0) {
    alerts.push({
      label: `${s.flowOverdue} task in ritardo`,
      href: "/admin/flow?due=overdue",
      severity: "warn",
    });
  }
  if (s.flowNoDueDate > 0) {
    alerts.push({
      label: `${s.flowNoDueDate} task aperti senza scadenza`,
      href: "/admin/flow",
      severity: "info",
    });
  }
  if (s.postsPending > 0) {
    alerts.push({
      label: `${s.postsPending} post in attesa di approvazione`,
      href: "/admin/posts?status=PENDING",
      severity: "warn",
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Insights</h1>
          <p className="text-muted-foreground">
            Sintesi cross-modulo · fuso recap: {s.timeZoneLabel}. Raccomandazioni euristiche da dati reali.
          </p>
        </div>
        <InsightsOpsDigestToolbar smtpEnabled={digestEmailEnabled()} />
      </div>

      {recommendations.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Raccomandazioni operative</CardTitle>
            <CardDescription>Priorità suggerite (non LLM).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {recommendations.map((r) => (
                <li key={r.id} className="rounded-md border border-border/60 p-3">
                  <Link className="font-medium text-primary hover:underline" href={r.href}>
                    {r.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {alerts.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Priorità del giorno</CardTitle>
            <CardDescription>Azioni suggerite da dati reali (non AI).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li key={a.href + a.label}>
                  <Link
                    className={
                      a.severity === "warn"
                        ? "font-medium text-amber-600 hover:underline dark:text-amber-400"
                        : "text-primary hover:underline"
                    }
                    href={a.href}
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Nessun alert critico. Buon lavoro.
          </CardContent>
        </Card>
      )}

      {upsellClients.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Service graph · cross-sell</CardTitle>
            <CardDescription>Clienti con più servizi catalogo non ancora attivi.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y">
              {upsellClients.map((c) => (
                <li key={c.clientId} className="flex justify-between gap-2 py-2">
                  <Link href={`/admin/clients/${c.clientId}`} className="font-medium text-primary hover:underline">
                    {c.companyName}
                  </Link>
                  <span className="text-muted-foreground">{c.missingCount} gap</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clienti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.clientsTotal}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/clients">Anagrafica</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lead attivi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.leadsOpen}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/crm/leads">Vedi lead</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opportunità aperte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.opportunitiesOpen}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/crm/pipeline">Pipeline</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Task Flow aperti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.flowOpen}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/flow">Flow</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline commerciale (forecast)</CardTitle>
          <CardDescription>
            Opportunità <strong>OPEN</strong> di tua proprietà: somma valori stimati e pipeline pesata per priorità.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">N. opportunità</p>
            <p className="text-2xl font-bold">{pipeline.openCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Somma stimata (EUR)</p>
            <p className="text-2xl font-bold">
              {pipeline.sumEstimatedEur.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pipeline pesata (EUR)</p>
            <p className="text-2xl font-bold">{pipeline.weightedPipelineLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2 self-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/insights/forecast">Pagina forecast</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/insights/revenue-at-risk">Revenue at risk</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/crm/opportunities">Apri opportunità</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memoria e contenuti</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <p>
            Voci memoria: <strong>{s.memoryTotal}</strong>
          </p>
          <p>
            Post in coda: <strong>{s.postsPending}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
