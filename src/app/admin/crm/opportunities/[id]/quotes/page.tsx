import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeQuoteTotals, formatEur, parseQuoteLinesJson } from "@/lib/quote-lines";

const statusLabel: Record<string, string> = {
  DRAFT: "Bozza",
  SENT: "Inviato",
  ACCEPTED: "Accettato",
  REJECTED: "Rifiutato",
};

export default async function OpportunityQuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id: opportunityId } = await params;
  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, ownerUserId: session.user.id },
    include: {
      client: { select: { companyName: true } },
      lead: { select: { businessName: true, title: true } },
    },
  });
  if (!opp) notFound();

  const quotes = await prisma.opportunityQuote.findMany({
    where: { opportunityId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/crm/opportunities/${opportunityId}/edit`}>← Opportunità</Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`/admin/crm/opportunities/${opportunityId}/quotes/new`}>+ Nuovo preventivo</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Preventivi</h1>
        <p className="text-muted-foreground">
          {opp.title}
          {opp.client
            ? ` · ${opp.client.companyName}`
            : opp.lead
              ? ` · Lead: ${opp.lead.businessName ?? opp.lead.title}`
              : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>Preventivi collegati all&apos;opportunità.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {quotes.length === 0 ? (
            <p className="text-muted-foreground">Nessun preventivo. Creane uno per iniziare.</p>
          ) : (
            <ul className="space-y-2">
              {quotes.map((q) => {
                const totals = computeQuoteTotals(parseQuoteLinesJson(q.linesJson), q.taxPercent);
                return (
                  <li key={q.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 p-3">
                    <div>
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/admin/crm/opportunities/${opportunityId}/quotes/${q.id}`}
                      >
                        {q.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {statusLabel[q.status] ?? q.status} · {formatEur(totals.total)}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/crm/opportunities/${opportunityId}/quotes/${q.id}`}>Apri</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
