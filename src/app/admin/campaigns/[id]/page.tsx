import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { getCampaignAnalytics } from "@/lib/campaigns";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusButton } from "../campaign-status-button";
import {
  CAMPAIGN_STATUS_BADGE,
  CAMPAIGN_STATUS_LABEL,
  eligibilityDescription,
  enrollmentStatusLabel,
  formatPercent,
  type CampaignAnalyticsRow,
  type CampaignStatus,
} from "../view-model";

export const dynamic = "force-dynamic";

const dateFmt = dateTimeFormatIt({ dateStyle: "medium" });

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{value.toLocaleString("it-IT")}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminArea();
  const { id } = await params;

  const [campaign, enrollments, analyticsRaw, services] = await Promise.all([
    prisma.crossSellCampaign.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepIndex: "asc" } },
      },
    }),
    prisma.campaignEnrollment.findMany({
      where: { campaignId: id },
      orderBy: { enrolledAt: "desc" },
      take: 100,
      include: { client: { select: { id: true, companyName: true } } },
    }),
    getCampaignAnalytics(id),
    prisma.commercialService.findMany({ select: { slug: true, name: true } }),
  ]);

  if (!campaign) notFound();

  const serviceName = new Map(services.map((s) => [s.slug, s.name]));
  const nameFor = (slug: string) => serviceName.get(slug) ?? slug;
  const status = campaign.status as CampaignStatus;
  const analytics = (analyticsRaw as CampaignAnalyticsRow[])?.find((a) => a.campaignId === id) ?? null;

  const targetName = nameFor(campaign.targetServiceSlug);
  const requiresNames = (campaign.requiresAnyOwnedSlug ?? []).map(nameFor);
  const excludesNames = (campaign.excludesOwnedSlug ?? []).map(nameFor);

  const funnel = {
    enrolled: analytics?.totalEnrollments ?? enrollments.length,
    sent: analytics?.simulatedSends ?? 0,
    opened: analytics?.opened ?? 0,
    clicked: analytics?.clicked ?? 0,
    converted: analytics?.converted ?? 0,
  };
  const funnelMax = Math.max(funnel.enrolled, funnel.sent, funnel.opened, funnel.clicked, funnel.converted, 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/campaigns">← Campagne</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="onizuka-page-title">{campaign.name}</h1>
            <Badge variant={CAMPAIGN_STATUS_BADGE[status]}>{CAMPAIGN_STATUS_LABEL[status]}</Badge>
            <Badge variant="outline">Priorità {campaign.priority}</Badge>
          </div>
          {campaign.description ? <p className="onizuka-page-lead max-w-2xl">{campaign.description}</p> : null}
          <p className="text-sm text-muted-foreground">{eligibilityDescription(targetName, requiresNames, excludesNames)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status === "ACTIVE" ? (
            <CampaignStatusButton
              campaignId={campaign.id}
              status="PAUSED"
              label="Metti in pausa"
              pendingLabel="Sospendo…"
              question="Sospendere la campagna?"
              variant="outline"
            />
          ) : status === "DRAFT" || status === "PAUSED" ? (
            <CampaignStatusButton
              campaignId={campaign.id}
              status="ACTIVE"
              label="Attiva campagna"
              pendingLabel="Attivo…"
              question="Attivare la campagna? (Fase 0: gli invii restano simulati)"
              variant="default"
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
        <p className="font-medium text-foreground">Simulazione attiva: nessuna email parte verso i clienti.</p>
        <p className="mt-1 text-muted-foreground">
          Gli invii mostrati sono simulati. Attivare la campagna aggiorna solo il suo stato: serve a validare regole,
          testi e tempistiche prima del go-live.
        </p>
      </div>

      {/* Regole di idoneità */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regole di idoneità</CardTitle>
          <CardDescription>Chi entra automaticamente nella campagna, in base ai servizi già attivi.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Servizio target</p>
            <p className="mt-1 font-medium">{targetName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deve avere almeno uno</p>
            <p className="mt-1">{requiresNames.length ? requiresNames.join(", ") : "— (nessun requisito)"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escludi se ha</p>
            <p className="mt-1">{excludesNames.length ? excludesNames.join(", ") : "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Analitiche + funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analitiche (simulazione)</CardTitle>
          <CardDescription>Percorso degli iscritti dal primo step alla conversione.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-5">
            {[
              { k: "Iscritti", v: funnel.enrolled },
              { k: "Inviati (sim.)", v: funnel.sent },
              { k: "Aperture", v: funnel.opened },
              { k: "Click", v: funnel.clicked },
              { k: "Conversioni", v: funnel.converted },
            ].map((m) => (
              <div key={m.k} className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                <p className="text-xs text-muted-foreground">{m.k}</p>
                <p className="text-xl font-bold tabular-nums">{m.v.toLocaleString("it-IT")}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <FunnelBar label="Iscritti" value={funnel.enrolled} max={funnelMax} />
            <FunnelBar label="Inviati (simulati)" value={funnel.sent} max={funnelMax} />
            <FunnelBar label="Aperture" value={funnel.opened} max={funnelMax} />
            <FunnelBar label="Click" value={funnel.clicked} max={funnelMax} />
            <FunnelBar label="Conversioni" value={funnel.converted} max={funnelMax} />
          </div>
          {analytics ? (
            <p className="text-xs text-muted-foreground">
              Tasso di conversione: {formatPercent(analytics.conversionRate)} · Iscritti attivi ora:{" "}
              {analytics.activeEnrollments}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Step (sola lettura, Fase 0) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequenza di step</CardTitle>
          <CardDescription>Testi e tempistiche degli invii (sola lettura in Fase 0).</CardDescription>
        </CardHeader>
        <CardContent>
          {campaign.steps.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuno step configurato.</p>
          ) : (
            <ol className="space-y-3">
              {campaign.steps.map((s) => (
                <li key={s.id} className="rounded-md border border-border/60 bg-card/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Step {s.stepIndex + 1}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {s.delayDays === 0 ? "subito" : `dopo ${s.delayDays} giorn${s.delayDays === 1 ? "o" : "i"}`}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{s.subject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Iscritti */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Iscritti</CardTitle>
          <CardDescription>
            {enrollments.length} client{enrollments.length === 1 ? "e" : "i"} in questa campagna (max 100 mostrati).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun cliente iscritto (in simulazione).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Stato iscrizione</th>
                    <th className="pb-2 pr-3 text-right font-medium">Step corrente</th>
                    <th className="pb-2 text-right font-medium">Iscritto il</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b align-top last:border-0">
                      <td className="py-3 pr-3">
                        <Link href={`/admin/clients/${e.clientId}`} className="font-medium text-primary hover:underline">
                          {e.client?.companyName ?? e.clientId}
                        </Link>
                        {e.simulated ? <span className="ml-2 text-xs text-muted-foreground">(sim.)</span> : null}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant="outline">{enrollmentStatusLabel(e.status)}</Badge>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">{e.currentStepIndex + 1}</td>
                      <td className="py-3 text-right text-muted-foreground">{dateFmt.format(e.enrolledAt)}</td>
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
