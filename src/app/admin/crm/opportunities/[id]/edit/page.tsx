import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OpportunityForm } from "../../opportunity-form";
import { OpportunityDeleteForm } from "../../opportunity-delete-form";
import { ClientContextBar } from "@/components/onizuka/client-context-bar";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const opportunity = await prisma.opportunity.findFirst({
    where: { id, ownerUserId: session.user.id },
    include: {
      client: { select: { id: true, companyName: true, contactEmail: true, vatNumber: true } },
      lead: { select: { id: true, title: true, businessName: true } },
    },
  });
  if (!opportunity) notFound();

  const leads = await prisma.lead.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, title: true, businessName: true },
  });

  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });

  const assets = await prisma.asset.findMany({
    orderBy: [{ clientId: "asc" }, { name: "asc" }],
    select: { id: true, clientId: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/opportunities">← Opportunità</Link>
        </Button>
      </div>
      {opportunity.client ? (
        <ClientContextBar
          clientId={opportunity.client.id}
          companyName={opportunity.client.companyName}
          vatNumber={opportunity.client.vatNumber}
          contactEmail={opportunity.client.contactEmail}
        />
      ) : opportunity.lead ? (
        <p className="text-sm text-muted-foreground">
          Collegata al lead{" "}
          <Link href={`/admin/crm/leads/${opportunity.lead.id}/edit`} className="text-primary hover:underline">
            {opportunity.lead.businessName ?? opportunity.lead.title}
          </Link>
          {opportunity.digitalAuditId ? (
            <>
              {" "}
              · audit{" "}
              <Link
                href={`/admin/audit/digital/${opportunity.digitalAuditId}`}
                className="text-primary hover:underline"
              >
                dettaglio
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Modifica opportunità</CardTitle>
          <CardDescription>
            Aggiorna stato commerciale, valore e prossime mosse.{" "}
            <Link className="text-primary hover:underline" href={`/admin/crm/opportunities/${opportunity.id}/quotes`}>
              Preventivi
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <OpportunityForm clients={clients} leads={leads} assets={assets} opportunity={opportunity} />
          <OpportunityDeleteForm opportunityId={opportunity.id} />
        </CardContent>
      </Card>
    </div>
  );
}
