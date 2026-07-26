import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { getCampaignAnalytics } from "@/lib/campaigns";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiBox } from "@/components/onizuka/kpi-box";
import {
  CAMPAIGN_STATUS_BADGE,
  CAMPAIGN_STATUS_LABEL,
  formatPercent,
  type CampaignAnalyticsRow,
} from "./view-model";

export const dynamic = "force-dynamic";

export default async function CampaignsIndexPage() {
  await requireAdminArea();

  const [rowsRaw, services] = await Promise.all([
    getCampaignAnalytics(),
    prisma.commercialService.findMany({ select: { slug: true, name: true } }),
  ]);
  const rows = [...((rowsRaw as CampaignAnalyticsRow[]) ?? [])].sort((a, b) => b.priority - a.priority);
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));

  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;
  const totalEnrollments = rows.reduce((sum, r) => sum + r.activeEnrollments, 0);
  const totalConversions = rows.reduce((sum, r) => sum + r.converted, 0);
  const totalEnrolledEver = rows.reduce((sum, r) => sum + r.totalEnrollments, 0);
  const globalRate = totalEnrolledEver > 0 ? totalConversions / totalEnrolledEver : 0;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Campagne cross-sell"
        lead="Sequenze automatiche che propongono al cliente giusto il servizio giusto, al momento giusto — basate su ciò che ha già attivo."
      />

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-foreground">Fase simulazione: nessuna email viene inviata ai clienti.</p>
        <p className="mt-1 text-muted-foreground">
          Le campagne restano in <strong>Bozza</strong> finché non le attivi. In questa fase gli invii sono solo
          simulati: servono a validare regole di idoneità, testi e tempistiche prima di andare live.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox label="Campagne attive" value={activeCount} hint={`su ${rows.length} totali`} />
        <KpiBox label="Iscritti attivi" value={totalEnrollments.toLocaleString("it-IT")} hint="clienti in sequenza" />
        <KpiBox label="Conversioni" value={totalConversions.toLocaleString("it-IT")} hint="obiettivo raggiunto" />
        <KpiBox label="Tasso di conversione" value={formatPercent(globalRate)} hint="conversioni / iscritti totali" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Elenco campagne</CardTitle>
          <CardDescription>Ordinate per priorità. Apri una campagna per regole, step e iscritti.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna campagna configurata. Le campagne cross-sell vengono definite lato motore (servizio target,
              regole di idoneità e step). Appena create compaiono qui in Bozza.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 font-medium">Campagna</th>
                    <th className="pb-2 pr-3 text-right font-medium">Priorità</th>
                    <th className="pb-2 font-medium">Servizio target</th>
                    <th className="pb-2 font-medium">Stato</th>
                    <th className="pb-2 pr-3 text-right font-medium">Step</th>
                    <th className="pb-2 pr-3 text-right font-medium">Iscritti attivi</th>
                    <th className="pb-2 text-right font-medium">Conversioni</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.campaignId} className="border-b align-top last:border-0">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/admin/campaigns/${r.campaignId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.name}
                        </Link>
                        {r.description ? (
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{r.priority}</td>
                      <td className="py-3 pr-3">{serviceName.get(r.targetServiceSlug) ?? r.targetServiceSlug}</td>
                      <td className="py-3 pr-3">
                        <Badge variant={CAMPAIGN_STATUS_BADGE[r.status]}>{CAMPAIGN_STATUS_LABEL[r.status]}</Badge>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{r.stepCount}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{r.activeEnrollments}</td>
                      <td className="py-3 text-right tabular-nums">
                        {r.converted}
                        <span className="ml-1 text-xs text-muted-foreground">({formatPercent(r.conversionRate)})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
