import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteCreateForm } from "../quote-create-form";

export default async function NewOpportunityQuotePage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/crm/opportunities/${opportunityId}/quotes`}>← Preventivi</Link>
      </Button>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Nuovo preventivo</CardTitle>
          <CardDescription>
            {opp.title}
            {opp.client
              ? ` · ${opp.client.companyName}`
              : opp.lead
                ? ` · Lead: ${opp.lead.businessName ?? opp.lead.title}`
                : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuoteCreateForm opportunityId={opportunityId} defaultTitle={`Preventivo — ${opp.title}`} />
        </CardContent>
      </Card>
    </div>
  );
}
