import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireFullAdmin } from "@/lib/admin-session";
import { loadFinanceStats } from "@/lib/finance-stats";
import {
  FINANCE_LONG_TERM_TARGET_EUR,
  FINANCE_MONTHLY_TARGET_EUR,
  loadFinanceLedgerStats,
} from "@/lib/finance-ledger-stats";
import { loadFinanceOverdueEntries } from "@/lib/finance-overdue";
import { loadFinanceRevenueByClient } from "@/lib/finance-client-revenue";
import { loadFinanceRevenueByAsset } from "@/lib/finance-revenue-by-asset";
import { prisma } from "@/lib/prisma";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FinanceEntryForm } from "./finance-entry-form";
import { FinanceEntryRowActions } from "./finance-entry-row-actions";
import { FinanceReconciliationPanel } from "./finance-reconciliation-panel";
import { ClientLink } from "@/components/onizuka/client-link";

const statusLabel: Record<string, string> = {
  PLANNED: "Pianificato",
  EXPECTED: "Atteso",
  RECEIVED: "Incassato",
  PAID: "Pagato",
  OVERDUE: "Scaduto",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminFinancePage({ searchParams }: Props) {
  const session = await requireFullAdmin();

  const clientIdRaw = searchParams.clientId;
  const clientId = typeof clientIdRaw === "string" && clientIdRaw.trim() ? clientIdRaw.trim() : null;
  const filterClient = clientId
    ? await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      })
    : null;

  const [result, ledger] = await Promise.all([
    loadFinanceStats(session.user.id),
    loadFinanceLedgerStats(session.user.id),
  ]);

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Finance</h1>
          <p className="text-muted-foreground">Sintesi pipeline e cashflow.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [overdue, revenueByClient, revenueByAsset, financeClients, financeAssets] = await Promise.all([
    loadFinanceOverdueEntries(session.user.id),
    loadFinanceRevenueByClient(session.user.id),
    loadFinanceRevenueByAsset(session.user.id),
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      take: 150,
      select: { id: true, companyName: true },
    }),
    prisma.asset.findMany({
      orderBy: [{ client: { companyName: "asc" } }, { name: "asc" }],
      take: 300,
      select: { id: true, name: true, clientId: true, platform: true },
    }),
  ]);

  const entries = await prisma.financeEntry.findMany({
    where: {
      ownerUserId: session.user.id,
      ...(clientId ? { clientId } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      client: { select: { companyName: true } },
      asset: { select: { name: true } },
    },
  });

  const s = result.stats;
  const l = ledger.ok ? ledger.stats : null;
  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Onizuka Finance</h1>
        <p className="text-muted-foreground">
          Pipeline CRM + registro entrate/uscite. Target mensile: € {FINANCE_MONTHLY_TARGET_EUR.toLocaleString("it-IT")}{" "}
          (lungo periodo € {FINANCE_LONG_TERM_TARGET_EUR.toLocaleString("it-IT")}).
        </p>
        {filterClient ? (
          <p className="mt-2 text-sm">
            Filtro cliente: <ClientLink clientId={filterClient.id} name={filterClient.companyName} />
            {" · "}
            <Link href="/admin/finance" className="text-primary hover:underline">
              Tutte le voci
            </Link>
            {" · "}
            <Link href={`/admin/clients/${filterClient.id}`} className="text-primary hover:underline">
              Scheda 360°
            </Link>
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/api/admin/finance/export">Esporta CSV</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/api/admin/finance/export-accounting">Export gestionale</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/api/admin/finance/export-accounting?double=1">Doppia registrazione</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/api/admin/finance/summary-pdf">Report PDF mese</Link>
          </Button>
        </div>
      </div>

      {l ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Netto mese (forecast)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">€ {l.monthNetForecastEur}</p>
              <p className="text-xs text-muted-foreground">
                Gap target: € {l.gapToTargetEur}
                {Number(l.gapToTargetEur.replace(/\./g, "").replace(",", ".")) > 0 ? " (sotto)" : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Entrate attese</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">€ {l.monthIncomeExpectedEur}</p>
              <p className="text-xs text-muted-foreground">Incassate: € {l.monthIncomeReceivedEur}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Uscite</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">€ {l.monthExpenseExpectedEur}</p>
              <p className="text-xs text-muted-foreground">Pagate: € {l.monthExpensePaidEur}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Insoluti</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{l.overdueCount}</p>
              <p className="text-xs text-muted-foreground">{l.entryCount} voci nel mese</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <FinanceReconciliationPanel ownerUserId={session.user.id} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline aperta</CardTitle>
            <CardDescription>{s.openCount} opportunità</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">€ {s.pipelineOpenEur}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Forecast pesato</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">€ {s.pipelineWeightedEur}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vinte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">€ {s.pipelineWonEur}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Perse</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.lostCount}</p>
          </CardContent>
        </Card>
      </div>

      {overdue.rows.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Scaduti ({overdue.rows.length})</CardTitle>
            <CardDescription>
              Saldo netto stimato (entrate − uscite scadute): €{" "}
              {overdue.totalEur.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y divide-border/60">
              {overdue.rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {row.label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {row.type === "INCOME" ? "Entrata" : "Uscita"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      € {row.amountEur}
                      {row.clientName ? ` · ${row.clientName}` : ""}
                      {row.dueDate ? ` · scad. ${dateFmt.format(row.dueDate)}` : ""}
                    </p>
                  </div>
                  <FinanceEntryRowActions entryId={row.id} type={row.type} status="OVERDUE" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {revenueByAsset.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Entrate per asset (mese)</CardTitle>
            <CardDescription>Canali collegati alle voci di fatturato.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y divide-border/60">
              {revenueByAsset.map((row) => (
                <li key={row.assetId} className="flex items-center justify-between py-2">
                  <span className="font-medium">
                    {row.assetName}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {row.clientName}
                      {row.platform ? ` · ${row.platform}` : ""}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    € {row.totalEur} · {row.entryCount} voci
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {revenueByClient.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Entrate per cliente (mese)</CardTitle>
            <CardDescription>Top clienti per fatturato previsto/incassato nel mese corrente.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y divide-border/60">
              {revenueByClient.map((row) => (
                <li key={row.clientId} className="flex items-center justify-between py-2">
                  <Link className="font-medium text-primary hover:underline" href={`/admin/clients/${row.clientId}`}>
                    {row.companyName}
                  </Link>
                  <span className="text-muted-foreground">
                    € {row.totalEur} · {row.entryCount} voci
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Nuova voce</CardTitle>
          <CardDescription>Entrate o uscite previste / effettive.</CardDescription>
        </CardHeader>
        <CardContent>
          <FinanceEntryForm clients={financeClients} assets={financeAssets} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{filterClient ? `Registro · ${filterClient.companyName}` : "Registro"}</CardTitle>
          <CardDescription>Ultime {entries.length} voci{filterClient ? " per questo cliente" : ""}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {entries.length === 0 ? (
            <p className="text-muted-foreground">Nessuna voce. Aggiungi la prima entrata o uscita.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {e.label}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {e.type === "INCOME" ? "Entrata" : "Uscita"} · {statusLabel[e.status]}
                        {e.type === "INCOME" && e.recurringMonthly ? (
                          <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-primary">MRR</span>
                        ) : null}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      € {Number(e.amountEur.toString()).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      {e.invoiceNumber ? ` · ${e.invoiceNumber}` : ""}
                      {e.client ? ` · ${e.client.companyName}` : ""}
                      {e.asset ? ` · ${e.asset.name}` : ""}
                      {e.dueDate ? ` · scad. ${dateFmt.format(e.dueDate)}` : ""}
                    </p>
                  </div>
                  <FinanceEntryRowActions
                    entryId={e.id}
                    type={e.type}
                    status={e.status}
                    sdiExportedAt={e.sdiExportedAt}
                    recurringMonthly={e.recurringMonthly}
                    renewalDate={e.renewalDate?.toISOString() ?? null}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CRM</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/crm/pipeline">Pipeline</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/opportunities">Opportunità</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
