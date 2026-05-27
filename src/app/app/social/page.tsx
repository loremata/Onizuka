import Link from "next/link";
import { requireAppClientContext } from "@/lib/app-client-session";
import { loadClientSocialMetrics } from "@/lib/client-social-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ClientSocialPage() {
  const ctx = await requireAppClientContext();
  const metrics = await loadClientSocialMetrics(ctx.clientId);
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Social Pro</h1>
        <p className="text-muted-foreground">Pubblicazioni e metriche dei contenuti approvati.</p>
      </div>
      <Link href="/app/dashboard" className="text-sm text-primary hover:underline">
        ← Dashboard
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pubblicati</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.publishedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In programma</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.scheduledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reach totale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.totalReach.toLocaleString("it-IT")}</p>
            <CardDescription>Engagement {metrics.avgEngagementRate}%</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impression</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics.totalImpressions.toLocaleString("it-IT")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app">Approva contenuti</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/plan">Piano editoriale</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimi post live</CardTitle>
          <CardDescription>Metriche aggiornate dall&apos;agenzia dopo la pubblicazione.</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.recentPublished.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun post pubblicato ancora.</p>
          ) : (
            <ul className="divide-y text-sm">
              {metrics.recentPublished.map((p) => (
                <li key={p.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                  <div>
                    <span className="text-xs uppercase text-muted-foreground">{p.platform}</span>
                    <p className="font-medium">{p.captionPreview}</p>
                    {p.publishUrl ? (
                      <a href={p.publishUrl} className="text-xs text-primary hover:underline" target="_blank" rel="noreferrer">
                        Vedi post
                      </a>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <p>{dateFmt.format(p.publishedAt)}</p>
                    <p className="tabular-nums">
                      {p.reach != null ? `Reach ${p.reach}` : "—"}
                      {p.engagement != null ? ` · Eng. ${p.engagement}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
