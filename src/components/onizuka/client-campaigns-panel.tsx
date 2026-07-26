import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getClientCampaignTimeline, getEligibleCampaignsForClientId } from "@/lib/campaigns";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CAMPAIGN_STATUS_BADGE,
  CAMPAIGN_STATUS_LABEL,
  enrollmentStatusLabel,
  type ClientCampaignTimelineEntry,
  type EligibleCampaignEntry,
} from "@/app/admin/campaigns/view-model";

const dateFmt = dateTimeFormatIt({ dateStyle: "medium" });

/**
 * Pannello "Campagne" della scheda cliente (Fase 0 — simulazione).
 * Mostra: iscrizione attuale, timeline campagne, prossime campagne idonee (in simulazione).
 * Nessun invio parte da qui.
 */
export async function ClientCampaignsPanel({ clientId }: { clientId: string }) {
  const [timelineRaw, eligibleRaw, services] = await Promise.all([
    getClientCampaignTimeline(clientId),
    getEligibleCampaignsForClientId(clientId),
    prisma.commercialService.findMany({ select: { slug: true, name: true } }),
  ]);

  const timeline = (timelineRaw as ClientCampaignTimelineEntry[]) ?? [];
  const eligible = (eligibleRaw as EligibleCampaignEntry[]) ?? [];
  const serviceName = new Map(services.map((s) => [s.slug, s.name]));

  const current = timeline.filter((t) => !t.convertedAt && !t.exitReason);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campagne cross-sell</CardTitle>
        <CardDescription>
          Sequenze automatiche di proposta servizi. Fase simulazione: nessuna email viene inviata al cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {/* Iscrizione attuale */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Iscrizione attuale</p>
          {current.length === 0 ? (
            <p className="mt-1 text-muted-foreground">Il cliente non è iscritto ad alcuna campagna in questo momento.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {current.map((c) => (
                <li key={c.campaignId} className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/campaigns/${c.campaignId}`} className="font-medium text-primary hover:underline">
                      {c.campaignName}
                    </Link>
                    <Badge variant="outline">{enrollmentStatusLabel(c.status)}</Badge>
                    <span className="text-xs text-muted-foreground">Step {c.currentStepIndex + 1}</span>
                    {c.simulated ? <span className="text-xs text-muted-foreground">· simulazione</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Iscritto il {dateFmt.format(c.enrolledAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Timeline campagne */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storico campagne</p>
          {timeline.length === 0 ? (
            <p className="mt-1 text-muted-foreground">Nessuna campagna registrata per questo cliente.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {timeline.map((t) => (
                <li key={`${t.campaignId}-${t.enrolledAt.toISOString()}`} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <Link href={`/admin/campaigns/${t.campaignId}`} className="font-medium text-primary hover:underline">
                      {t.campaignName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {enrollmentStatusLabel(t.status)}
                      {t.convertedAt ? ` · convertito il ${dateFmt.format(t.convertedAt)}` : ""}
                      {t.exitReason ? ` · uscito: ${t.exitReason}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={t.enrolledAt.toISOString()}>
                    {dateFmt.format(t.enrolledAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Prossime idonee (simulazione) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prossime campagne idonee (simulazione)
          </p>
          {eligible.length === 0 ? (
            <p className="mt-1 text-muted-foreground">
              Nessuna campagna idonea al momento in base ai servizi già attivi.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {eligible.map((e) => (
                <li key={e.campaignId} className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/campaigns/${e.campaignId}`} className="font-medium text-primary hover:underline">
                      {e.campaignName}
                    </Link>
                    <Badge variant={CAMPAIGN_STATUS_BADGE[e.status]}>{CAMPAIGN_STATUS_LABEL[e.status]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      target: {serviceName.get(e.targetServiceSlug) ?? e.targetServiceSlug}
                    </span>
                  </div>
                  {e.reason ? <p className="mt-1 text-xs text-muted-foreground">{e.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t pt-3">
          <Button asChild variant="link" className="h-auto p-0 text-xs">
            <Link href="/admin/campaigns">Gestisci campagne cross-sell</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
