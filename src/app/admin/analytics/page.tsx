import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { Sparkline } from "@/components/onizuka/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { loadAnalyticsDashboard, loadAudienceBreakdown, sourceLabel, type MetricCard } from "@/lib/analytics-dashboard";
import type { AnalyticsSource } from "@prisma/client";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function AnalyticsPage({ searchParams }: Props) {
  await requireAdminArea();
  const clientId = typeof searchParams.clientId === "string" ? searchParams.clientId : "";

  const loaded = await runWithDb(() =>
    prisma.client.findMany({
      orderBy: [{ isOwnBrand: "desc" }, { companyName: "asc" }],
      select: { id: true, companyName: true, isOwnBrand: true },
    })
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <SocialHubTabs />
        <h1 className="onizuka-page-title">Analytics</h1>
        <DbUnavailableBanner />
      </div>
    );
  }

  const clients = loaded.data;
  const dashboard = clientId ? await loadAnalyticsDashboard(clientId) : null;
  const audience = clientId ? await loadAudienceBreakdown(clientId) : null;

  // Raggruppa le card per fonte
  const bySource = new Map<AnalyticsSource, MetricCard[]>();
  if (dashboard) {
    for (const c of dashboard.cards) {
      const arr = bySource.get(c.source) ?? [];
      arr.push(c);
      bySource.set(c.source, arr);
    }
  }

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <h1 className="onizuka-page-title">Analytics</h1>
        <p className="text-muted-foreground">
          Cruscotto unico delle performance: social, sito e advertising nel tempo. Ogni fonte compare qui man mano
          che viene collegata e i collector raccolgono i dati.{" "}
          <Link href="/admin/analytics/connections" className="text-primary hover:underline">
            Connessioni (GA4/Ads)
          </Link>
          {" · "}
          <Link href="/admin/analytics/competitors" className="text-primary hover:underline">
            Competitor
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente / brand</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Select
              name="clientId"
              defaultValue={clientId}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleziona…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                  {c.isOwnBrand ? " ⭐" : ""}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm" variant="secondary">
              Apri
            </Button>
          </form>
        </CardContent>
      </Card>

      {!clientId ? (
        <p className="text-sm text-muted-foreground">Seleziona un cliente per vedere il cruscotto.</p>
      ) : !dashboard?.hasData ? (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
            <p>Nessun dato ancora raccolto per questo cliente.</p>
            <p>
              Questa è la <strong>fondazione</strong> del modulo: i cruscotti si popolano man mano che colleghiamo le
              fonti — sito (GA4), snapshot social, advertising. La struttura è pronta a riceverli.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-muted-foreground">Andamento ultimi {dashboard.days} giorni.</p>

          {audience && (
            <Card>
              <CardHeader>
                <CardTitle>Pubblico</CardTitle>
                <CardDescription>Composizione dei follower per sesso, età e paese (ultimo dato).</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-3">
                {([
                  { title: "Sesso", slices: audience.gender },
                  { title: "Età", slices: audience.age },
                  { title: "Paese", slices: audience.country },
                ] as const).map((col) =>
                  col.slices.length === 0 ? null : (
                    <div key={col.title} className="space-y-2">
                      <p className="text-sm font-medium">{col.title}</p>
                      {col.slices.map((s) => (
                        <div key={s.label} className="space-y-0.5">
                          <div className="flex justify-between text-xs">
                            <span>{s.label}</span>
                            <span className="text-muted-foreground">{s.pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded bg-muted">
                            <div className="h-1.5 rounded bg-primary" style={{ width: `${s.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )}
          {Array.from(bySource.entries()).map(([source, cards]) => (
            <Card key={source}>
              <CardHeader>
                <CardTitle>{sourceLabel[source]}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((c) => {
                  const up = c.delta !== null && c.delta >= 0;
                  return (
                    <div key={c.metricKey} className="rounded-lg border p-3">
                      <p className="text-sm font-medium text-muted-foreground">{c.label}</p>
                      <p className="text-2xl font-bold">
                        {c.latest !== null ? c.latest.toLocaleString("it-IT") : "—"}
                      </p>
                      {c.deltaPct !== null && (
                        <p className={`text-xs ${up ? "text-primary" : "text-destructive"}`}>
                          {up ? "▲" : "▼"} {Math.abs(c.deltaPct)}% nel periodo
                        </p>
                      )}
                      <div className={up ? "mt-2 text-primary" : "mt-2 text-destructive"}>
                        <Sparkline values={c.series.map((s) => s.value)} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
