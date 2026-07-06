import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { loadReachMetrics } from "@/lib/reach-metrics";
import { loadReachStats } from "@/lib/reach-stats";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OutreachDraftForm } from "./outreach-draft-form";
import { OutreachDraftActions } from "./outreach-draft-actions";
import { isSmtpConfigured } from "@/lib/smtp-send";
import { hasOutreachAb } from "@/lib/outreach-ab";
import { getOwnerReachAbDefaultVariant } from "@/lib/reach-ab-default";
import { ReachAbDefaultButton } from "./reach-ab-default-button";
import { ReachWhatsAppPanel } from "./reach-whatsapp-panel";
import { EntityClientLabel } from "@/components/onizuka/client-link";
import { parseReachListFilters } from "@/lib/reach-list-filters";

export default async function AdminReachPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireAdminArea();
  const listFilters = parseReachListFilters(searchParams);
  const filterClient = listFilters.clientId
    ? await prisma.client.findUnique({
        where: { id: listFilters.clientId },
        select: { id: true, companyName: true },
      })
    : null;

  const [statsResult, metricsResult] = await Promise.all([
    loadReachStats(session.user.id),
    loadReachMetrics(session.user.id),
  ]);
  const draftsLoaded = await runWithDb(() =>
    Promise.all([
      prisma.outreachDraft.findMany({
        where: {
          ownerUserId: session.user.id,
          ...(listFilters.clientId ? { clientId: listFilters.clientId } : {}),
          // "Solo inviabili": esclude le bozze dei lead scrapati senza email vera
          // (contatto segnaposto @onizuka.local) che intaserebbero la lista.
          ...(searchParams.sendable === "1"
            ? { client: { contactEmail: { not: { endsWith: "@onizuka.local" } } } }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
        include: {
          client: { select: { id: true, companyName: true, contactEmail: true } },
          lead: { select: { id: true, title: true, businessName: true, email: true } },
        },
      }),
      prisma.client.findMany({
        orderBy: { companyName: "asc" },
        select: { id: true, companyName: true },
      }),
    ])
  );

  if (!statsResult.ok || !draftsLoaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Onizuka Reach</h1>
          <p className="text-muted-foreground">Outreach con approvazione obbligatoria (MVP).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const s = statsResult.stats;
  const [drafts, clients] = draftsLoaded.data;
  const showNew = searchParams.new === "1";
  const smtpConfigured = isSmtpConfigured();
  const reachAbDefault = await getOwnerReachAbDefaultVariant(session.user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Onizuka Reach</h1>
        <p className="text-muted-foreground">
          Bozze email: bozza → approvazione → invio SMTP (se configurato) o mailto → segna inviata.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/admin/reach/sequences">Sequenze follow-up (J+0, J+3, J+7)</Link>
        </Button>
        {filterClient ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Filtro cliente:{" "}
            <Link href={`/admin/clients/${filterClient.id}`} className="text-primary hover:underline">
              {filterClient.companyName}
            </Link>
            {" · "}
            <Link href="/admin/reach" className="text-primary hover:underline">
              Rimuovi filtro
            </Link>
          </p>
        ) : null}
      </div>

      <ReachWhatsAppPanel />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lead da contattare</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.leadsToFollow}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/crm/leads">Apri lead</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opportunità aperte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.openOpportunities}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clienti dormienti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.dormantClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Da riattivare</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.clientsToReactivate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bozze in approvazione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.pendingDrafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sequenze attive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.activeSequences}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/reach/sequences">Gestisci</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {metricsResult.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Metriche invio</CardTitle>
            <CardDescription>Ultimi 30 giorni · basate su timestamp invio.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-muted-foreground">Inviate (7g)</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.sentLast7Days}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Inviate (30g)</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.sentLast30Days}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tasso invio / approvate</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.approvalRatePercent}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ore medie bozza → invio</p>
              <p className="text-2xl font-bold">
                {metricsResult.metrics.avgHoursToSend != null
                  ? `${metricsResult.metrics.avgHoursToSend}h`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Aperture email</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.openRatePercent}%</p>
              <p className="text-xs text-muted-foreground">{metricsResult.metrics.openedCount} tracciate</p>
            </div>
            <div>
              <p className="text-muted-foreground">Click link</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.clickRatePercent}%</p>
              <p className="text-xs text-muted-foreground">{metricsResult.metrics.clickedCount} tracciati</p>
            </div>
            <div>
              <p className="text-muted-foreground">Inviate variante A</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.abSentA}</p>
              <p className="text-xs text-muted-foreground">
                aperture {metricsResult.metrics.abOpenRateA}% · click {metricsResult.metrics.abClickRateA}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Inviate variante B</p>
              <p className="text-2xl font-bold">{metricsResult.metrics.abSentB}</p>
              <p className="text-xs text-muted-foreground">
                aperture {metricsResult.metrics.abOpenRateB}% · click {metricsResult.metrics.abClickRateB}%
              </p>
            </div>
            {metricsResult.metrics.abWinnerSuggested ? (
              <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-muted-foreground">Vincitore A/B suggerito</p>
                <p className="text-2xl font-bold">Variante {metricsResult.metrics.abWinnerSuggested}</p>
                <p className="text-xs text-muted-foreground">
                  Basato su aperture e click (min. 3 invii per variante).
                </p>
                <ReachAbDefaultButton
                  suggestedWinner={metricsResult.metrics.abWinnerSuggested}
                  currentDefault={reachAbDefault}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {showNew ? (
        <Card>
          <CardHeader>
            <CardTitle>Nuova bozza</CardTitle>
          </CardHeader>
          <CardContent>
            <OutreachDraftForm clients={clients} />
          </CardContent>
        </Card>
      ) : (
        <Button asChild size="sm" variant="secondary">
          <Link href="/admin/reach?new=1">+ Nuova bozza email</Link>
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Bozze outreach</CardTitle>
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href={searchParams.sendable === "1" ? "/admin/reach" : "/admin/reach?sendable=1"}>
                {searchParams.sendable === "1" ? "Mostra tutte" : "Solo inviabili (con email)"}
              </Link>
            </Button>
          </div>
          <CardDescription>Approvazione richiesta prima di segnare come inviata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {drafts.length === 0 ? (
            <p className="text-muted-foreground">Nessuna bozza. Creane una sopra.</p>
          ) : (
            drafts.map((d) => {
              const recipientEmail = (d.client?.contactEmail || d.lead?.email || "").trim();
              const noEmail = !recipientEmail || /@onizuka\.local$/i.test(recipientEmail);
              return (
              <div key={d.id} className="rounded-md border border-border/60 p-3">
                <p className="font-medium">
                  {d.subject}
                  {hasOutreachAb(d) ? (
                    <span className="ml-2 rounded bg-muted px-1 text-[10px] font-normal">A/B</span>
                  ) : null}
                  {noEmail ? (
                    <span className="ml-2 rounded bg-amber-100 px-1 text-[10px] font-normal text-amber-800">
                      ⚠️ senza email · WhatsApp/tel
                    </span>
                  ) : null}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <EntityClientLabel
                    clientId={d.client?.id}
                    clientName={d.client?.companyName}
                    leadId={d.lead?.id}
                    leadName={d.lead?.businessName?.trim() || d.lead?.title}
                    fallback="Generica"
                  />
                  <span>· {d.status}</span>
                  {d.sentAt
                    ? ` · inviata ${dateTimeFormatIt({ dateStyle: "short" }).format(d.sentAt)}`
                    : ` · ${dateTimeFormatIt({ dateStyle: "short" }).format(d.updatedAt)}`}
                  {d.openedAt
                    ? ` · aperta ${d.openCount > 1 ? `(${d.openCount}×)` : ""}`
                    : d.status === "SENT"
                      ? " · non aperta"
                      : ""}
                  {d.clickedAt ? ` · click ${d.clickCount > 1 ? `(${d.clickCount}×)` : ""}` : ""}
                </p>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{d.body}</p>
                <div className="mt-2">
                  <OutreachDraftActions
                    id={d.id}
                    status={d.status}
                    smtpConfigured={smtpConfigured}
                    hasAb={hasOutreachAb(d)}
                    abVariantSent={d.abVariantSent}
                    defaultAbVariant={reachAbDefault ?? undefined}
                  />
                </div>
              </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
