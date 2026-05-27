import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAppClientContext } from "@/lib/app-client-session";
import { loadClientPortalKpi } from "@/lib/client-portal-kpi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiTrendBars } from "@/components/onizuka/kpi-trend-bars";

export default async function ClientDashboardPage() {
  const ctx = await requireAppClientContext();
  const kpi = await loadClientPortalKpi(ctx.clientId, ctx.userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Dashboard</h1>
        <p className="onizuka-page-lead">Panoramica contenuti, supporto e notifiche.</p>
      </div>
      <Link href="/app" className="text-sm text-primary hover:underline">
        ← Approvazioni contenuti
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In attesa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi.postsPending}</p>
            <CardDescription>su {kpi.postsTotal} post totali</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasso approvazione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi.approvalRatePercent}%</p>
            <CardDescription>{kpi.postsApproved} approvati</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket aperti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi.ticketsOpen}</p>
            <CardDescription>{kpi.ticketsWithUnreadReplies} con risposte non lette</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notifiche</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpi.notificationsUnread}</p>
            <CardDescription>non lette</CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app">Revisiona post</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/tickets">Supporto</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/notifications">Notifiche</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/plan">Piano editoriale</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/social">Social Pro · metriche</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/projects">Progetti</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/gallery">Galleria</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Approvazioni ultimi 7 giorni</CardTitle>
          <CardDescription>Contenuti passati in stato approvato.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <KpiTrendBars buckets={kpi.approvalsLast7Days} />
          <ul className="flex flex-wrap gap-3 text-sm">
            {kpi.approvalsLast7Days.map((d) => (
              <li key={d.day} className="rounded-md border border-border/50 px-2 py-1">
                <span className="text-muted-foreground">{d.label}</span>{" "}
                <span className="font-semibold tabular-nums">{d.count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {kpi.postsRevision > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-4 text-sm">
            Hai <strong>{kpi.postsRevision}</strong> contenuti in revisione —{" "}
            <Link href="/app?status=NEEDS_REVISION" className="text-primary hover:underline">
              visualizza
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
