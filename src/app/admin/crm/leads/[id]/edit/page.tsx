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
import { leadStageHistory } from "@/lib/lead-stage";
import { commercialProspectStageLabel } from "@/lib/commercial-prospect-stage";
import { dateTimeFormatIt } from "@/lib/datetime-it";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const lead = await prisma.lead.findFirst({
    where: { id, ownerUserId: session.user.id },
  });
  if (!lead) notFound();

  const [clients, referrers, auditSummary, storicoStadi] = await Promise.all([
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
    leadStageHistory(id),
  ]);

  const quando = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

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

      {/* Il percorso: dove sta il lead adesso e come ci è arrivato. Prima lo stadio
          si vedeva solo nel presente, e per capire se un lead era fermo si tirava a
          indovinare. */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Percorso del lead</CardTitle>
          <CardDescription>
            Adesso: <strong>{lead.commercialProspectStage
              ? commercialProspectStageLabel[lead.commercialProspectStage]
              : "nessuno stadio"}</strong>{" "}
            (stato {lead.status.toLowerCase()}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {storicoStadi.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun passaggio registrato: lo storico parte dai cambi di stadio più recenti.
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {storicoStadi.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-muted-foreground">{quando.format(e.at)}</span>
                  <span>
                    {e.fromStage ? commercialProspectStageLabel[e.fromStage] : "inizio"} →{" "}
                    <strong>{commercialProspectStageLabel[e.toStage]}</strong>
                  </span>
                  {e.source ? <span className="text-muted-foreground">· {e.source}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
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
