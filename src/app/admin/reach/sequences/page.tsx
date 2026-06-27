import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SequenceRowActions } from "./sequence-row-actions";
import { CreateSequenceForm } from "./create-sequence-form";
import { runWithDb } from "@/lib/with-db";

const statusLabel: Record<string, string> = {
  ACTIVE: "Attiva",
  PAUSED: "In pausa",
  COMPLETED: "Completata",
  CANCELLED: "Annullata",
};

const stepStatusLabel: Record<string, string> = {
  SCHEDULED: "Programmato",
  ACTIVATED: "Bozza pronta",
  SENT: "Inviato",
  SKIPPED: "Saltato",
  CANCELLED: "Annullato",
};

export default async function OutreachSequencesPage() {
  const session = await requireAdminArea();

  const clientsLoaded = await runWithDb(() =>
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      take: 200,
      select: { id: true, companyName: true },
    })
  );

  const leadsLoaded = await runWithDb(() =>
    prisma.lead.findMany({
      where: {
        ownerUserId: session.user.id,
        status: { notIn: ["CONVERTED", "LOST"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, businessName: true },
    })
  );

  const loaded = await runWithDb(() =>
    prisma.outreachSequence.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        client: { select: { companyName: true } },
        lead: { select: { title: true, businessName: true } },
        steps: { orderBy: { stepIndex: "asc" }, include: { outreachDraft: { select: { id: true } } } },
        digitalAudit: { select: { id: true } },
      },
    })
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <h1 className="onizuka-page-title">Sequenze Reach</h1>
        <DbUnavailableBanner />
      </div>
    );
  }

  const sequences = loaded.data;
  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/reach">← Reach</Link>
        </Button>
        <h1 className="mt-2 onizuka-page-title">Sequenze Reach</h1>
        <p className="text-muted-foreground">
          Follow-up automatici J+0, J+3, J+7. Ogni step genera una bozza in approvazione; il cron attiva le
          scadenze giornaliere.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuova sequenza manuale</CardTitle>
          <CardDescription>
            Crea J+0, J+3, J+7 su cliente o lead senza audit. La prima bozza va in approvazione in Reach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientsLoaded.ok && leadsLoaded.ok ? (
            <CreateSequenceForm
              clients={clientsLoaded.data}
              leads={leadsLoaded.data.map((l) => ({
                id: l.id,
                label: l.businessName?.trim() || l.title,
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Database non disponibile.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Come funziona</CardTitle>
          <CardDescription>
            Le sequenze post-audit partono quando avvii un audit con bozza Reach. Cron:{" "}
            <code className="rounded bg-muted px-1 text-xs">GET /api/cron/reach-sequences</code> (08:00 UTC).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sequenze ({sequences.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          {sequences.length === 0 ? (
            <p className="text-muted-foreground">
              Nessuna sequenza. Avvia un audit digitale con checkbox Reach per crearne una automaticamente.
            </p>
          ) : (
            sequences.map((seq) => (
              <div key={seq.id} className="rounded-md border border-border/60 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      <Link className="hover:underline" href={`/admin/reach/sequences/${seq.id}`}>
                        {seq.name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {seq.client?.companyName ??
                        seq.lead?.businessName?.trim() ??
                        seq.lead?.title ??
                        "—"}{" "}
                      · {statusLabel[seq.status] ?? seq.status}
                      {seq.digitalAudit ? (
                        <>
                          {" "}
                          ·{" "}
                          <Link
                            className="text-primary hover:underline"
                            href={`/admin/audit/digital/${seq.digitalAudit.id}`}
                          >
                            Audit
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <SequenceRowActions sequenceId={seq.id} status={seq.status} />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {seq.steps.map((st) => (
                    <li key={st.id} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">Step {st.stepIndex + 1}</span>
                      <span className="text-muted-foreground">J+{st.delayDays}</span>
                      <span>{stepStatusLabel[st.status] ?? st.status}</span>
                      <span className="text-muted-foreground">{dateFmt.format(st.scheduledFor)}</span>
                      {st.outreachDraft ? (
                        <Link className="text-primary hover:underline" href="/admin/reach">
                          bozza
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
