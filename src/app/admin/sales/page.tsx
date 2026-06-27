import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { loadSalesStats } from "@/lib/sales-stats";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SALES_PLAYBOOKS } from "@/lib/sales-playbooks";
import { computeQuoteTotals, formatEur, parseQuoteLinesJson } from "@/lib/quote-lines";
import { ClientLink } from "@/components/onizuka/client-link";

export default async function AdminSalesPage() {
  const session = await requireAdminArea();

  const result = await loadSalesStats(session.user.id);

  if (!result.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Onizuka Sales</h1>
          <p className="text-muted-foreground">Motore commerciale (MVP).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const s = result.stats;

  const recentQuotes = await prisma.opportunityQuote.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 8,
    include: {
      opportunity: {
        select: {
          id: true,
          title: true,
          client: { select: { id: true, companyName: true } },
          lead: { select: { id: true, businessName: true, title: true } },
        },
      },
    },
  });

  const quoteStatusLabel: Record<string, string> = {
    DRAFT: "Bozza",
    SENT: "Inviato",
    ACCEPTED: "Accettato",
    REJECTED: "Rifiutato",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Onizuka Sales</h1>
        <p className="text-muted-foreground">
          Vista legacy — usa la{" "}
          <Link href="/admin/crm/commercial" className="text-primary hover:underline">
            Dashboard commerciale
          </Link>{" "}
          per KPI operativi completi.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/crm/commercial">Dashboard commerciale</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/sales/brands">Brand ecosistema</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aperte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vinte (90g)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{s.wonLast90Days}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Perse (90g)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.lostLast90Days}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lead caldi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{s.leadsQualified}</p>
            <p className="text-xs text-muted-foreground">QUALIFIED + CONTACTED</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top opportunità aperte</CardTitle>
          <CardDescription>Per valore stimato decrescente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {s.topOpen.length === 0 ? (
            <p className="text-muted-foreground">Nessuna opportunità aperta.</p>
          ) : (
            <ul className="space-y-2">
              {s.topOpen.map((o) => (
                <li key={o.id}>
                  <Link className="font-medium text-primary hover:underline" href={`/admin/crm/opportunities/${o.id}/edit`}>
                    {o.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    · <ClientLink clientId={o.clientId} name={o.clientName} className="font-normal" />
                    {o.value ? ` · ${o.value}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/admin/crm/pipeline">Apri pipeline</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preventivi recenti</CardTitle>
          <CardDescription>Collegati alle opportunità CRM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {recentQuotes.length === 0 ? (
            <p className="text-muted-foreground">Nessun preventivo. Creane uno da un&apos;opportunità.</p>
          ) : (
            <ul className="space-y-2">
              {recentQuotes.map((q) => {
                const total = computeQuoteTotals(parseQuoteLinesJson(q.linesJson), q.taxPercent).total;
                return (
                  <li key={q.id}>
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/admin/crm/opportunities/${q.opportunity.id}/quotes/${q.id}`}
                    >
                      {q.title}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      ·{" "}
                      {q.opportunity.client ? (
                        <ClientLink
                          clientId={q.opportunity.client.id}
                          name={q.opportunity.client.companyName}
                          className="font-normal"
                        />
                      ) : (
                        <Link
                          href={`/admin/crm/leads/${q.opportunity.lead?.id}/edit`}
                          className="text-primary hover:underline"
                        >
                          {q.opportunity.lead?.businessName ?? q.opportunity.lead?.title ?? "Lead"}
                        </Link>
                      )}{" "}
                      · {quoteStatusLabel[q.status] ?? q.status} ·{" "}
                      {formatEur(total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Playbook commerciali</CardTitle>
          <CardDescription>Script di partenza per call e follow-up (personalizza prima dell&apos;invio).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {SALES_PLAYBOOKS.map((p) => (
            <div key={p.id} className="rounded-md border border-border/60 p-3">
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">Quando: {p.when}</p>
              <p className="mt-2 italic text-muted-foreground">&ldquo;{p.opener}&rdquo;</p>
              <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
