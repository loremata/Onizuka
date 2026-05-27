import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseQuoteLinesJson } from "@/lib/quote-lines";
import { QuoteEditForm } from "../../quote-edit-form";

export default async function EditOpportunityQuotePage({
  params,
}: {
  params: Promise<{ id: string; quoteId: string }>;
}) {
  const session = await requireAdminArea();

  const { id: opportunityId, quoteId } = await params;

  const quote = await prisma.opportunityQuote.findFirst({
    where: { id: quoteId, opportunityId, ownerUserId: session.user.id },
  });
  if (!quote) notFound();

  const lines = parseQuoteLinesJson(quote.linesJson);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/crm/opportunities/${opportunityId}/quotes/${quoteId}`}>← Preventivo</Link>
      </Button>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Modifica preventivo</CardTitle>
          <CardDescription>Aggiorna righe, IVA e note. Lo stato non cambia da qui.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuoteEditForm
            opportunityId={opportunityId}
            quoteId={quoteId}
            title={quote.title}
            notes={quote.notes}
            taxPercent={quote.taxPercent}
            validUntilIso={quote.validUntil?.toISOString() ?? null}
            defaultLines={lines}
          />
        </CardContent>
      </Card>
    </div>
  );
}
