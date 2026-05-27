import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadForm } from "../../lead-form";
import { LeadDeleteForm } from "../../lead-delete-form";
import { loadAuditCommercialSummaryForLead } from "@/lib/load-audit-commercial-summary";
import { AuditCommercialSummaryCard } from "@/components/onizuka/audit-commercial-summary-card";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!lead) notFound();

  const [clients, referrers, auditSummary] = await Promise.all([
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.referrer.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    loadAuditCommercialSummaryForLead(id, session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/leads">← Lead</Link>
        </Button>
        {!lead.convertedClientId ? (
          <Button asChild size="sm">
            <Link href={`/admin/crm/leads/${lead.id}/convert`}>Converti in cliente</Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/clients/${lead.convertedClientId}`}>Apri scheda cliente</Link>
          </Button>
        )}
      </div>
      {auditSummary ? <AuditCommercialSummaryCard summary={auditSummary} /> : null}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Modifica lead</CardTitle>
          <CardDescription>Aggiorna stato, contatti e collegamento a cliente CRM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <LeadForm clients={clients} referrers={referrers} lead={lead} />
          <LeadDeleteForm leadId={lead.id} />
        </CardContent>
      </Card>
    </div>
  );
}
