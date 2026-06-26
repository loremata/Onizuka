import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { AnalyticsHubTabs } from "@/components/onizuka/analytics-hub-tabs";
import { loadCommercialDashboard } from "@/lib/commercial-dashboard";
import { parseCommercialDashboardFilters } from "@/lib/commercial-dashboard-filters";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { CommercialKpiGrid } from "@/components/onizuka/commercial-kpi-grid";
import { CommercialDashboardSection } from "@/components/onizuka/commercial-dashboard-section";
import { CommercialDashboardFiltersBar } from "@/components/onizuka/commercial-dashboard-filters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommercialDashboardPage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const params = await searchParams;
  const filters = parseCommercialDashboardFilters(params);
  const result = await loadCommercialDashboard(session.user.id, session.user.timeZone, filters);

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard commerciale</h1>
          <p className="text-muted-foreground">Revenue intelligence e priorità operative.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const d = result.data;

  return (
    <div className="space-y-8">
      <AnalyticsHubTabs />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard commerciale</h1>
          <p className="text-muted-foreground">
            Priorità da Lead, audit, opportunity e monetizzazione — dati reali, azioni dirette.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/crm/pipeline">Pipeline</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/audit/digital">Audit digitale</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/insights">Insights ops</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/sales">Sales legacy</Link>
            </Button>
          </div>
        </div>
      </div>

      <CommercialDashboardFiltersBar filters={d.filters} />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sintesi pipeline</CardTitle>
          <CardDescription>
            Rinnovi imminenti: {d.renewals30} (30g) · {d.renewals60} (60g) · {d.renewals90} (90g) ·
            pesato € {d.pipelineWeightedEur}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/crm/pipeline">Apri pipeline</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/renewals">Rinnovi retail</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/insights/forecast">Forecast</Link>
          </Button>
        </CardContent>
      </Card>

      <CommercialKpiGrid items={d.kpis} />

      <div className="grid gap-6 xl:grid-cols-2">
        <CommercialDashboardSection
          title="1. Oggi devo fare"
          description="Task urgenti, preventivi e comunicazioni."
          rows={d.today}
        />
        <CommercialDashboardSection
          title="2. Opportunità commerciali"
          description="Aperte, da audit, con prossimo step."
          rows={d.opportunities}
          emptyLabel="Nessuna opportunity aperta con i filtri attuali."
        />
        <CommercialDashboardSection
          title="3. Audit & prospecting"
          description="Audit critici e lead caldi."
          rows={d.auditProspecting}
        />
        <CommercialDashboardSection
          title="4. Clienti & monetizzazione"
          description="Up-sell, incassi, rinnovi."
          rows={d.clientsMonetization}
        />
      </div>

      <CommercialDashboardSection
        title="5. Igiene dati"
        description="Record incompleti e revisioni."
        rows={d.dataHygiene}
        emptyLabel="Nessuna anomalia prioritaria."
      />
    </div>
  );
}
