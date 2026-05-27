import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { listIntelligenceRecommendations } from "@/lib/intelligence-nba";
import { loadIntelligenceTrends } from "@/lib/intelligence-trends";
import { IntelligencePanel } from "@/components/onizuka/intelligence-panel";
import { KpiTrendBars } from "@/components/onizuka/kpi-trend-bars";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function IntelligencePage() {
  const session = await requireAdminArea();
  const [items, trends] = await Promise.all([
    listIntelligenceRecommendations(session.user.id),
    loadIntelligenceTrends(session.user.id, 30),
  ]);
  const trendBuckets = trends.map((t) => ({
    day: t.day,
    label: t.day.slice(5),
    count: t.created,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">← Command Center</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Intelligence</h1>
        <p className="text-muted-foreground">
          Next-best-action da pipeline, clienti dormienti, finance e Reach.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Trend 30 giorni</CardTitle>
          <CardDescription>Raccomandazioni create / ignorate per giorno.</CardDescription>
        </CardHeader>
        <CardContent>
          <KpiTrendBars buckets={trendBuckets} maxBarHeight={40} />
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {trends.slice(-7).map((t) => (
              <li key={t.day} className="rounded border px-2 py-1">
                {t.day.slice(5)}: <strong>{t.created}</strong> nuove
                {t.dismissed > 0 ? ` · ${t.dismissed} ignorate` : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raccomandazioni</CardTitle>
          <CardDescription>Persistite in DB; ignora o rigenera.</CardDescription>
        </CardHeader>
        <CardContent>
          <IntelligencePanel initialItems={items} />
        </CardContent>
      </Card>
    </div>
  );
}
