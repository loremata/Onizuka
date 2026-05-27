import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadOwnerRecurringMrrEur } from "@/lib/finance-mrr";
import { loadUpcomingFinanceRenewals } from "@/lib/finance-renewals";
import { syncFinanceOverdueStatuses } from "@/lib/finance-overdue";
import { loadOwnerPipelineForecast } from "@/lib/insights-pipeline-forecast";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminInsightsForecastPage() {
  const session = await requireAdminArea();
  const ownerId = session.user.id;

  await syncFinanceOverdueStatuses(ownerId);

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [pipeline, topOpportunities, overdueFinance, mrr, dueSoon, renewals] = await Promise.all([
    loadOwnerPipelineForecast(ownerId),
    prisma.opportunity.findMany({
      where: { ownerUserId: ownerId, status: "OPEN" },
      orderBy: [{ estimatedValue: "desc" }, { updatedAt: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        priority: true,
        estimatedValue: true,
        dueDate: true,
        client: { select: { companyName: true } },
      },
    }),
    prisma.financeEntry.count({
      where: { ownerUserId: ownerId, status: "OVERDUE" },
    }),
    loadOwnerRecurringMrrEur(ownerId),
    prisma.opportunity.findMany({
      where: {
        ownerUserId: ownerId,
        status: "OPEN",
        dueDate: { not: null, gte: now, lte: in30 },
      },
      orderBy: { dueDate: "asc" },
      take: 25,
      select: {
        id: true,
        title: true,
        dueDate: true,
        estimatedValue: true,
        client: { select: { companyName: true } },
      },
    }),
    loadUpcomingFinanceRenewals(ownerId, 60),
  ]);

  const fmtDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "short" });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forecast commerciale</h1>
          <p className="text-muted-foreground">
            Pipeline delle tue opportunità <strong>OPEN</strong>, MRR da voci finance ricorrenti, e scadenze{" "}
            <strong>OVERDUE</strong> dopo sync automatico delle date.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/insights">← Insights</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Opportunità aperte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pipeline.openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Somma stimata (EUR)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {pipeline.sumEstimatedEur.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline pesata</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pipeline.weightedPipelineLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MRR finance (ricorrenti)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {mrr.sumEur.toLocaleString("it-IT", { maximumFractionDigits: 0 })} €
            </p>
            <p className="text-xs text-muted-foreground">{mrr.count} voci entrate flaggate</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/finance">Gestisci in Finance</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Finance OVERDUE</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overdueFinance}</p>
            <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
              <Link href="/admin/finance">Apri finance</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top opportunità (per valore stimato)</CardTitle>
          <CardDescription>Massimo 20 righe; collegamento alla scheda opportunità.</CardDescription>
        </CardHeader>
        <CardContent>
          {topOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna opportunità OPEN.</p>
          ) : (
            <ul className="divide-y text-sm">
              {topOpportunities.map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <Link className="font-medium text-primary hover:underline" href={`/admin/crm/opportunities/${o.id}/edit`}>
                      {o.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {o.client?.companyName ?? "Prospect"} · {o.priority}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {o.estimatedValue != null
                      ? `${Number(o.estimatedValue.toString()).toLocaleString("it-IT", { maximumFractionDigits: 0 })} €`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/admin/crm/pipeline">Vedi pipeline Kanban</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scadenze opportunità (30 giorni)</CardTitle>
          <CardDescription>
            Opportunità <strong>OPEN</strong> con <code className="text-xs">dueDate</code> entro un mese — promemoria
            go-to-market.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dueSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna scadenza nel periodo.</p>
          ) : (
            <ul className="divide-y text-sm">
              {dueSoon.map((o) => (
                <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <Link className="font-medium text-primary hover:underline" href={`/admin/crm/opportunities/${o.id}/edit`}>
                      {o.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {o.client?.companyName ?? "Prospect"}
                      {o.dueDate ? ` · scadenza ${fmtDate.format(o.dueDate)}` : ""}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {o.estimatedValue != null
                      ? `${Number(o.estimatedValue.toString()).toLocaleString("it-IT", { maximumFractionDigits: 0 })} €`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rinnovi MRR (60 giorni)</CardTitle>
          <CardDescription>
            Entrate con flag <strong>recurringMonthly</strong> e data <code className="text-xs">renewalDate</code>{" "}
            impostata in Finance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renewals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun rinnovo in scadenza nel periodo.</p>
          ) : (
            <ul className="divide-y text-sm">
              {renewals.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.clientName ?? "—"} · rinnovo {fmtDate.format(r.renewalDate)}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground">
                    {r.amountEur.toLocaleString("it-IT", { maximumFractionDigits: 0 })} €/mese
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="mt-2 h-auto p-0 text-xs">
            <Link href="/admin/finance">Gestisci in Finance</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
