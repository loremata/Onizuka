import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConvertLeadForm } from "../../convert-lead-form";

export default async function ConvertLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!lead) notFound();
  if (lead.convertedClientId) {
    redirect(`/admin/clients/${lead.convertedClientId}`);
  }

  const companyName = (lead.businessName?.trim() || lead.title) ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/admin/crm/leads/${lead.id}/edit`}>← Modifica lead</Link>
        </Button>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Converti in cliente</CardTitle>
          <CardDescription>
            Verrà creato un nuovo record in CRM e il lead passerà allo stato «Convertito», collegato alla
            scheda cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Lead: {lead.title}</p>
            {lead.contactName && <p>Contatto: {lead.contactName}</p>}
            {lead.source && <p>Origine: {lead.source}</p>}
          </div>
          <ConvertLeadForm
            leadId={lead.id}
            companyName={companyName}
            contactEmail={lead.email ?? ""}
            phone={lead.phone ?? ""}
            vatNumber={lead.vatNumber ?? ""}
          />
        </CardContent>
      </Card>
    </div>
  );
}
