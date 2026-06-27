import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { computeQuoteTotals, formatEur, parseQuoteLinesJson } from "@/lib/quote-lines";
import { quoteEmailEnabled } from "@/lib/quote-email";
import { QuotePrintActions } from "./quote-print-actions";
import { QuoteSendButton } from "./quote-send-button";
import { QuoteStatusActions } from "./quote-status-actions";
import { ClientContextBar } from "@/components/onizuka/client-context-bar";

const statusLabel: Record<string, string> = {
  DRAFT: "Bozza",
  SENT: "Inviato",
  ACCEPTED: "Accettato",
  REJECTED: "Rifiutato",
};

export default async function OpportunityQuotePage({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const session = await requireAdminArea();

  const { id: opportunityId, quoteId } = await params;

  const quote = await prisma.opportunityQuote.findFirst({
    where: { id: quoteId, opportunityId, ownerUserId: session.user.id },
    include: {
      opportunity: {
        include: {
          client: { select: { id: true, companyName: true, contactEmail: true, vatNumber: true } },
          lead: { select: { id: true, title: true, businessName: true } },
        },
      },
    },
  });
  if (!quote) notFound();

  const lines = parseQuoteLinesJson(quote.linesJson);
  const totals = computeQuoteTotals(lines, quote.taxPercent);
  const dateFmt = dateTimeFormatIt({ dateStyle: "long" });
  const emailEnabled = quoteEmailEnabled();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/crm/opportunities/${opportunityId}/quotes`}>← Preventivi</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/crm/opportunities/${opportunityId}/quotes/${quoteId}/edit`}>Modifica</Link>
          </Button>
          <QuotePrintActions quoteId={quote.id} />
          <QuoteSendButton quoteId={quote.id} enabled={emailEnabled} />
          <QuoteStatusActions quoteId={quote.id} current={quote.status} />
        </div>
      </div>

      {quote.opportunity.client ? (
        <ClientContextBar
          clientId={quote.opportunity.client.id}
          companyName={quote.opportunity.client.companyName}
          vatNumber={quote.opportunity.client.vatNumber}
          contactEmail={quote.opportunity.client.contactEmail}
        />
      ) : quote.opportunity.lead ? (
        <p className="text-sm text-muted-foreground">
          Lead:{" "}
          <Link
            href={`/admin/crm/leads/${quote.opportunity.lead.id}/edit`}
            className="text-primary hover:underline"
          >
            {quote.opportunity.lead.businessName ?? quote.opportunity.lead.title}
          </Link>
        </p>
      ) : null}

      <article
        id="quote-print"
        className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm print:border-0 print:shadow-none"
      >
        <header className="space-y-1 border-b border-border pb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Onizuka · Preventivo</p>
          <h1 className="onizuka-page-title">{quote.title}</h1>
          <p className="text-sm text-muted-foreground">
            {quote.opportunity.client
              ? `Cliente: ${quote.opportunity.client.companyName}${quote.opportunity.client.vatNumber ? ` · P.IVA ${quote.opportunity.client.vatNumber}` : ""}`
              : quote.opportunity.lead
                ? `Lead: ${quote.opportunity.lead.businessName ?? quote.opportunity.lead.title}`
                : "Anagrafica non collegata"}
          </p>
          <p className="text-sm text-muted-foreground">
            Opportunità: {quote.opportunity.title} · Stato: {statusLabel[quote.status] ?? quote.status}
            {quote.validUntil ? ` · Valido fino al ${dateFmt.format(quote.validUntil)}` : ""}
          </p>
        </header>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2">Descrizione</th>
              <th className="pb-2 text-right">Q.tà</th>
              <th className="pb-2 text-right">Prezzo</th>
              <th className="pb-2 text-right">Importo</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border/40">
                <td className="py-2 pr-2">{l.description}</td>
                <td className="py-2 text-right">{l.quantity}</td>
                <td className="py-2 text-right">{formatEur(l.unitPrice)}</td>
                <td className="py-2 text-right">{formatEur(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-muted-foreground">Imponibile</span>
            <span>{formatEur(totals.subtotal)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-muted-foreground">IVA ({quote.taxPercent}%)</span>
            <span>{formatEur(totals.tax)}</span>
          </p>
          <p className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Totale</span>
            <span>{formatEur(totals.total)}</span>
          </p>
        </div>

        {quote.notes?.trim() ? (
          <section className="text-sm">
            <h2 className="font-medium">Note</h2>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{quote.notes}</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
