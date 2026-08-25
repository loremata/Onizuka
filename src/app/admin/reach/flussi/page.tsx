import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { validateOutreachDraft } from "@/lib/outreach-quality";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Dashboard dei flussi outreach: audit fatti, lead creati, bozze in approvazione,
 * scarti con il PERCHÉ (statusNote), coda audit e job di scraping.
 * Tutto in sola lettura, server-side: serve a vedere dove il flusso si ferma.
 */

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const QUEUE_STATUSES: { status: "PENDING" | "PROCESSING" | "DONE" | "SKIPPED" | "FAILED"; label: string; variant: BadgeVariant }[] = [
  { status: "PENDING", label: "In coda", variant: "secondary" },
  { status: "PROCESSING", label: "In lavorazione", variant: "default" },
  { status: "DONE", label: "Completati", variant: "success" },
  { status: "SKIPPED", label: "Saltati", variant: "warning" },
  { status: "FAILED", label: "Falliti", variant: "destructive" },
];

const SCRAPE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  QUEUED: { label: "In coda", variant: "secondary" },
  RUNNING: { label: "In esecuzione", variant: "default" },
  DONE: { label: "Completato", variant: "success" },
  ERROR: { label: "Errore", variant: "destructive" },
};

type RecipientSource = {
  client: { contactEmail: string | null } | null;
  lead: { email: string | null } | null;
};

type CompanySource = {
  client: { companyName: string } | null;
  lead: { title: string; businessName: string | null } | null;
};

/** Email destinataria risolta come in reach/page.tsx: contatto cliente, poi lead. */
function resolveRecipient(d: RecipientSource): { email: string; sendable: boolean } {
  const email = (d.client?.contactEmail || d.lead?.email || "").trim();
  const sendable = Boolean(email) && !/@onizuka\.local$/i.test(email);
  return { email, sendable };
}

function companyLabel(d: CompanySource): string {
  return d.client?.companyName || d.lead?.businessName?.trim() || d.lead?.title || "—";
}

function truncate(text: string, max = 160): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Conteggi per giorno (ultimi `days` giorni, oggi incluso) su fuso Italia.
 * Aggrega in JS un elenco di sole date già filtrato lato DB.
 */
function buildDailyCounts(dates: Date[], days = 14): { key: string; label: string; count: number }[] {
  const keyFmt = dateTimeFormatIt({ year: "numeric", month: "2-digit", day: "2-digit" });
  const labelFmt = dateTimeFormatIt({ day: "2-digit", month: "2-digit" });
  const now = new Date();
  const scaffold: { key: string; label: string; count: number }[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86_400_000);
    const key = keyFmt.format(day);
    index.set(key, scaffold.length);
    scaffold.push({ key, label: labelFmt.format(day), count: 0 });
  }
  for (const date of dates) {
    const pos = index.get(keyFmt.format(date));
    if (pos != null) scaffold[pos].count += 1;
  }
  return scaffold;
}

/** Mini istogramma per giorno, solo div: nessun client component. */
function DailyCountsStrip({ data }: { data: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1 overflow-x-auto pt-1">
      {data.map((d) => (
        <div key={d.key} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1">
          <span className="text-xs font-medium tabular-nums">{d.count}</span>
          <div className="flex h-16 w-full items-end overflow-hidden rounded bg-muted/40">
            <div
              className="w-full rounded-t bg-primary/70"
              style={{ height: `${Math.round((d.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function AdminReachFlussiPage() {
  const session = await requireAdminArea();
  const ownerUserId = session.user.id;

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  // Finestra larga 14 giorni: il bucketing per giorno (fuso Italia) scarta gli estremi.
  const d14 = new Date(now.getTime() - 14 * 86_400_000);

  const result = await runWithDb(async () => {
    const [
      leadTotal,
      leadRealEmail,
      auditCompleted,
      seqActive,
      seqPaused,
      approvedCount,
      sent7,
      sent30,
      sentTotal,
      repliedCount,
      cancelledTotal,
    ] = await Promise.all([
      prisma.lead.count({ where: { ownerUserId } }),
      prisma.lead.count({
        where: {
          ownerUserId,
          email: { not: null },
          NOT: { email: { endsWith: "@onizuka.local" } },
        },
      }),
      prisma.digitalAudit.count({ where: { ownerUserId, status: "COMPLETED" } }),
      prisma.outreachSequence.count({ where: { ownerUserId, status: "ACTIVE" } }),
      prisma.outreachSequence.count({ where: { ownerUserId, status: "PAUSED" } }),
      prisma.outreachDraft.count({ where: { ownerUserId, status: "APPROVED" } }),
      prisma.outreachDraft.count({ where: { ownerUserId, status: "SENT", sentAt: { gte: d7 } } }),
      prisma.outreachDraft.count({ where: { ownerUserId, status: "SENT", sentAt: { gte: d30 } } }),
      prisma.outreachDraft.count({ where: { ownerUserId, status: "SENT" } }),
      prisma.outreachDraft.count({ where: { ownerUserId, repliedAt: { not: null } } }),
      prisma.outreachDraft.count({ where: { ownerUserId, status: "CANCELLED" } }),
    ]);

    const [
      pendingRecipients,
      pendingRows,
      cancelledByNote,
      cancelledRows,
      queueByStatus,
      queueProblemRows,
      auditDates,
      auditAvg,
      leadDates,
      leadBySource,
      scrapeJobs,
    ] = await Promise.all([
      // Tutte le PENDING_APPROVAL con la sola email: serve allo split del tile.
      prisma.outreachDraft.findMany({
        where: { ownerUserId, status: "PENDING_APPROVAL" },
        select: {
          id: true,
          client: { select: { contactEmail: true } },
          lead: { select: { email: true } },
        },
      }),
      prisma.outreachDraft.findMany({
        where: { ownerUserId, status: "PENDING_APPROVAL" },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          subject: true,
          body: true,
          createdAt: true,
          client: { select: { companyName: true, contactEmail: true } },
          lead: { select: { title: true, businessName: true, email: true } },
        },
      }),
      prisma.outreachDraft.groupBy({
        by: ["statusNote"],
        where: { ownerUserId, status: "CANCELLED" },
        _count: { _all: true },
      }),
      prisma.outreachDraft.findMany({
        where: { ownerUserId, status: "CANCELLED" },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          statusNote: true,
          updatedAt: true,
          client: { select: { companyName: true } },
          lead: { select: { title: true, businessName: true } },
        },
      }),
      prisma.auditSheetQueueItem.groupBy({
        by: ["status"],
        where: { ownerUserId },
        _count: { _all: true },
      }),
      prisma.auditSheetQueueItem.findMany({
        where: { ownerUserId, status: { in: ["SKIPPED", "FAILED"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          businessName: true,
          sheetRowKey: true,
          status: true,
          errorDetail: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      prisma.digitalAudit.findMany({
        where: { ownerUserId, createdAt: { gte: d14 } },
        select: { createdAt: true },
      }),
      prisma.digitalAudit.aggregate({
        where: { ownerUserId },
        _avg: { overallScore: true },
      }),
      prisma.lead.findMany({
        where: { ownerUserId, createdAt: { gte: d14 } },
        select: { createdAt: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { ownerUserId },
        _count: { _all: true },
      }),
      // Coda mono-workspace (come /api/admin/crm/scraping/status): nessun filtro owner.
      prisma.scrapeJob.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          comune: true,
          provincia: true,
          status: true,
          createdAt: true,
          error: true,
        },
      }),
    ]);

    return {
      leadTotal,
      leadRealEmail,
      auditCompleted,
      seqActive,
      seqPaused,
      approvedCount,
      sent7,
      sent30,
      sentTotal,
      repliedCount,
      cancelledTotal,
      pendingRecipients,
      pendingRows,
      cancelledByNote,
      cancelledRows,
      queueByStatus,
      queueProblemRows,
      auditDates,
      auditAvg,
      leadDates,
      leadBySource,
      scrapeJobs,
    };
  });

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Flussi outreach</h1>
          <p className="text-muted-foreground">Audit, lead, bozze in approvazione e scarti: dove si ferma il flusso.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const data = result.data;
  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });
  const dateTimeFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });
  const numFmt = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

  const pendingTotal = data.pendingRecipients.length;
  const pendingSendable = data.pendingRecipients.filter((d) => resolveRecipient(d).sendable).length;
  const pendingNoEmail = pendingTotal - pendingSendable;

  const cancelledReasons = [...data.cancelledByNote].sort((a, b) => b._count._all - a._count._all);
  const queueCountByStatus = new Map(data.queueByStatus.map((g) => [g.status, g._count._all]));

  const auditDaily = buildDailyCounts(data.auditDates.map((a) => a.createdAt));
  const leadDaily = buildDailyCounts(data.leadDates.map((l) => l.createdAt));
  const auditLast14 = auditDaily.reduce((sum, d) => sum + d.count, 0);
  const leadLast14 = leadDaily.reduce((sum, d) => sum + d.count, 0);
  const avgScore = data.auditAvg._avg.overallScore;

  const topSources = [...data.leadBySource]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Flussi outreach</h1>
        <p className="text-muted-foreground">
          Audit fatti, lead creati, bozze in approvazione e scarti con il motivo: il funnel sotto controllo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/reach">Onizuka Reach</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/audit/digital">Audit digitale</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/scraping">Scraping aziende</Link>
          </Button>
        </div>
      </div>

      {/* 1 · Tiles funnel */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Lead totali" value={String(data.leadTotal)} />
        <StatTile
          label="Lead con email reale"
          value={String(data.leadRealEmail)}
          hint="email presente, non segnaposto @onizuka.local"
        />
        <StatTile label="Audit completati" value={String(data.auditCompleted)} />
        <StatTile
          label="Sequenze"
          value={`${data.seqActive} / ${data.seqPaused}`}
          hint="attive / in pausa"
        />
        <StatTile
          label="In attesa di approvazione"
          value={String(pendingTotal)}
          hint={`${pendingSendable} inviabili · ${pendingNoEmail} senza email reale`}
        />
        <StatTile label="Approvate" value={String(data.approvedCount)} />
        <StatTile
          label="Inviate"
          value={String(data.sentTotal)}
          hint={`7g: ${data.sent7} · 30g: ${data.sent30}`}
        />
        <StatTile
          label="Risposte"
          value={String(data.repliedCount)}
          hint="email con risposta ricevuta"
        />
        <StatTile
          label="Scartate"
          value={String(data.cancelledTotal)}
          hint="bozze annullate (totale storico)"
        />
      </div>

      {/* 2 · In attesa di approvazione adesso */}
      <Card>
        <CardHeader>
          <CardTitle>In attesa di approvazione adesso</CardTitle>
          <CardDescription>
            Ultime {Math.min(pendingTotal, 30)} bozze PENDING_APPROVAL · il badge qualità anticipa cosa si
            bloccherebbe all&apos;invio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.pendingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna bozza in attesa di approvazione.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 pr-3 font-medium">Azienda</th>
                    <th className="pb-2 pr-3 font-medium">Email destinataria</th>
                    <th className="pb-2 pr-3 font-medium">Qualità testo</th>
                    <th className="pb-2 font-medium">Creata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingRows.map((d) => {
                    const recipient = resolveRecipient(d);
                    const quality = validateOutreachDraft({ subject: d.subject, body: d.body });
                    return (
                      <tr key={d.id} className="border-b align-top last:border-0">
                        <td className="py-2 pr-3 font-medium">{companyLabel(d)}</td>
                        <td className="py-2 pr-3">
                          {recipient.sendable ? (
                            <span className="text-muted-foreground">{recipient.email}</span>
                          ) : (
                            <Badge variant="destructive">senza email</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {quality.ok ? (
                            <Badge variant="success">ok</Badge>
                          ) : (
                            <Badge variant="warning">{quality.problems[0]?.message ?? "problema di qualità"}</Badge>
                          )}
                        </td>
                        <td className="py-2 whitespace-nowrap text-muted-foreground">
                          {dateTimeFmt.format(d.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3 · Scarti e blocchi — perché */}
      <Card>
        <CardHeader>
          <CardTitle>Scarti e blocchi — perché</CardTitle>
          <CardDescription>
            Bozze CANCELLED raggruppate per motivo (statusNote) e le ultime 30 in ordine di aggiornamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {cancelledReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna bozza scartata.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 pr-3 font-medium">Motivo</th>
                    <th className="pb-2 text-right font-medium">Bozze</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledReasons.map((g) => (
                    <tr key={g.statusNote ?? "__null__"} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3">
                        {g.statusNote ?? (
                          <span className="text-muted-foreground">senza motivo registrato (storico)</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{g._count._all}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.cancelledRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 pr-3 font-medium">Azienda</th>
                    <th className="pb-2 pr-3 font-medium">Motivo</th>
                    <th className="pb-2 font-medium">Aggiornata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cancelledRows.map((d) => (
                    <tr key={d.id} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3 font-medium">{companyLabel(d)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{d.statusNote?.trim() || "—"}</td>
                      <td className="py-2 whitespace-nowrap text-muted-foreground">
                        {dateFmt.format(d.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 4 · Coda audit */}
      <Card>
        <CardHeader>
          <CardTitle>Coda audit</CardTitle>
          <CardDescription>Righe importate dallo Sheet / scraping in coda per audit digitale.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5 text-sm">
            {QUEUE_STATUSES.map((s) => (
              <div key={s.status}>
                <p className="text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{queueCountByStatus.get(s.status) ?? 0}</p>
              </div>
            ))}
          </div>

          {data.queueProblemRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun item saltato o fallito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 pr-3 font-medium">Attività</th>
                    <th className="pb-2 pr-3 font-medium">Stato</th>
                    <th className="pb-2 pr-3 font-medium">Dettaglio</th>
                    <th className="pb-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {data.queueProblemRows.map((item) => {
                    const badge =
                      QUEUE_STATUSES.find((s) => s.status === item.status) ?? QUEUE_STATUSES[0];
                    return (
                      <tr key={item.id} className="border-b align-top last:border-0">
                        <td className="py-2 pr-3 font-medium">
                          {item.businessName?.trim() || item.sheetRowKey}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant={badge.variant}>{item.status}</Badge>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {item.errorDetail ? truncate(item.errorDetail) : "—"}
                        </td>
                        <td className="py-2 whitespace-nowrap text-muted-foreground">
                          {dateFmt.format(item.processedAt ?? item.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5 · Audit fatti */}
      <Card>
        <CardHeader>
          <CardTitle>Audit fatti</CardTitle>
          <CardDescription>
            {auditLast14} audit creati negli ultimi 14 giorni · punteggio medio complessivo:{" "}
            {avgScore != null ? `${numFmt.format(avgScore)}/100` : "—"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyCountsStrip data={auditDaily} />
        </CardContent>
      </Card>

      {/* 6 · Lead creati */}
      <Card>
        <CardHeader>
          <CardTitle>Lead creati</CardTitle>
          <CardDescription>{leadLast14} lead creati negli ultimi 14 giorni · fonti sul totale storico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DailyCountsStrip data={leadDaily} />

          {topSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun lead registrato.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 pr-3 font-medium">Fonte</th>
                    <th className="pb-2 pr-3 text-right font-medium">Lead</th>
                    <th className="pb-2 text-right font-medium">% sul totale</th>
                  </tr>
                </thead>
                <tbody>
                  {topSources.map((g) => (
                    <tr key={g.source ?? "__null__"} className="border-b align-top last:border-0">
                      <td className="py-2 pr-3">
                        {g.source ?? <span className="text-muted-foreground">senza fonte</span>}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{g._count._all}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {data.leadTotal > 0 ? `${Math.round((g._count._all / data.leadTotal) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7 · Job di scraping */}
      <Card>
        <CardHeader>
          <CardTitle>Job di scraping</CardTitle>
          <CardDescription>Ultimi 10 job per comune (worker esterno).</CardDescription>
        </CardHeader>
        <CardContent>
          {data.scrapeJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun job di scraping avviato.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 pr-3 font-medium">Comune</th>
                    <th className="pb-2 pr-3 font-medium">Provincia</th>
                    <th className="pb-2 pr-3 font-medium">Stato</th>
                    <th className="pb-2 pr-3 font-medium">Creato</th>
                    <th className="pb-2 font-medium">Errore</th>
                  </tr>
                </thead>
                <tbody>
                  {data.scrapeJobs.map((job) => {
                    const badge = SCRAPE_STATUS[job.status] ?? { label: job.status, variant: "secondary" as const };
                    return (
                      <tr key={job.id} className="border-b align-top last:border-0">
                        <td className="py-2 pr-3 font-medium">{job.comune}</td>
                        <td className="py-2 pr-3">{job.provincia}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                          {dateFmt.format(job.createdAt)}
                        </td>
                        <td className="py-2 text-muted-foreground">{job.error ? truncate(job.error) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
