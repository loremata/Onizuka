import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { SocialHubTabs } from "@/components/onizuka/social-hub-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { buildSocialInsights } from "@/lib/social-insights";
import { loadStoredInsightReport } from "@/lib/social-insights-store";
import { AiNarrative } from "./ai-narrative";

type Props = { searchParams: Record<string, string | string[] | undefined> };

const priorityBadge: Record<"high" | "medium" | "low", string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/10 text-amber-600",
  low: "bg-primary/10 text-primary",
};

export default async function SocialInsightsPage({ searchParams }: Props) {
  await requireAdminArea();
  const clientId = typeof searchParams.clientId === "string" ? searchParams.clientId : "";

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.client.findMany({
        orderBy: [{ isOwnBrand: "desc" }, { companyName: "asc" }],
        select: { id: true, companyName: true, slug: true, isOwnBrand: true },
      }),
      clientId
        ? prisma.client.findUnique({ where: { id: clientId }, select: { companyName: true } })
        : Promise.resolve(null),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <SocialHubTabs />
        <h1 className="onizuka-page-title">Insight AI</h1>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [clients, client] = loaded.data;
  const insights = clientId ? await buildSocialInsights(clientId) : null;
  const storedReport = clientId ? await loadStoredInsightReport(clientId) : null;
  const dateFmt = dateTimeFormatIt({ dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <SocialHubTabs />
      <div>
        <h1 className="onizuka-page-title">Insight AI</h1>
        <p className="text-muted-foreground">
          Analisi delle performance social per cliente + suggerimenti aggiornati su cosa funziona e cosa correggere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Select
              name="clientId"
              defaultValue={clientId}
              className="flex h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleziona un cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                  {c.isOwnBrand ? " ⭐" : ""}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm" variant="secondary">
              Analizza
            </Button>
          </form>
        </CardContent>
      </Card>

      {!clientId ? (
        <p className="text-sm text-muted-foreground">Seleziona un cliente per vedere gli insight.</p>
      ) : !insights?.hasData ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nessun dato pubblicato negli ultimi {insights?.windowDays ?? 90} giorni per{" "}
            {client?.companyName ?? "questo cliente"}.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Post pubblicati" value={insights.totalPublished.toString()} />
            <Kpi label="Reach totale" value={insights.totals.reach.toLocaleString("it-IT")} />
            <Kpi label="Impression" value={insights.totals.impressions.toLocaleString("it-IT")} />
            <Kpi
              label="Engagement rate"
              value={`${insights.totals.engagementRate}%`}
              sub={
                insights.trend.deltaPct === null
                  ? undefined
                  : `${insights.trend.deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(insights.trend.deltaPct)}% vs periodo prec.`
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Suggerimenti</CardTitle>
              <CardDescription>Basati sui dati degli ultimi {insights.windowDays} giorni.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun suggerimento specifico: continua così.</p>
              ) : (
                insights.suggestions.map((s) => (
                  <div key={s.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 rounded px-2 py-0.5 text-xs font-medium ${priorityBadge[s.priority]}`}>
                      {s.priority === "high" ? "Alta" : s.priority === "medium" ? "Media" : "Bassa"}
                    </span>
                    <span>
                      <strong>{s.title}.</strong> {s.detail}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Per piattaforma</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {insights.byPlatform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between border-b border-border/50 pb-1">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-muted-foreground">
                      {p.publishedCount} post · reach {p.reach.toLocaleString("it-IT")} · eng {p.engagementRate}%
                    </span>
                  </div>
                ))}
                <div className="pt-2 text-xs text-muted-foreground">
                  {insights.bestDayOfWeek && <>Giorno migliore: <strong>{insights.bestDayOfWeek.label}</strong>. </>}
                  {insights.bestTimeBucket && <>Fascia: <strong>{insights.bestTimeBucket.label}</strong>.</>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top post per engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {insights.topPosts.map((p) => (
                  <div key={p.id} className="border-b border-border/50 pb-1">
                    <p className="font-medium">
                      {p.label} · eng {p.engagement.toLocaleString("it-IT")} · reach {p.reach.toLocaleString("it-IT")}
                    </p>
                    <p className="text-muted-foreground">
                      {p.publishedAt ? dateFmt.format(p.publishedAt) : "—"} · {p.captionPreview}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Analisi del team AI</CardTitle>
              <CardDescription>
                Più esperti (contenuti, cadenza, canali, crescita locale) studiano i dati e un direttore sintetizza il piano.
                Si aggiorna da sola col refresh automatico; qui puoi rigenerarla al volo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AiNarrative
                clientId={clientId}
                report={
                  storedReport
                    ? {
                        aiGenerated: storedReport.aiGenerated,
                        model: storedReport.model,
                        narrative: storedReport.narrative,
                        lenses: storedReport.lenses,
                        generatedAt: storedReport.generatedAt.toISOString(),
                      }
                    : null
                }
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <CardDescription>{sub}</CardDescription>}
      </CardContent>
    </Card>
  );
}
