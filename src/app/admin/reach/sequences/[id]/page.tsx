import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SequenceStepForm } from "./sequence-step-form";
import { EntityClientLabel } from "@/components/onizuka/client-link";

const stepStatusLabel: Record<string, string> = {
  SCHEDULED: "Programmato",
  ACTIVATED: "Bozza pronta",
  SENT: "Inviato",
  SKIPPED: "Saltato",
  CANCELLED: "Annullato",
};

export default async function SequenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();
  const { id } = await params;

  const seq = await prisma.outreachSequence.findFirst({
    where: { id, ownerUserId: session.user.id },
    include: {
      steps: { orderBy: { stepIndex: "asc" } },
      client: { select: { id: true, companyName: true } },
      lead: { select: { id: true, title: true, businessName: true } },
    },
  });

  if (!seq) notFound();

  const dateFmt = dateTimeFormatIt({ dateStyle: "short" });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/reach/sequences">← Sequenze</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{seq.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <EntityClientLabel
            clientId={seq.client?.id}
            clientName={seq.client?.companyName}
            leadId={seq.lead?.id}
            leadName={seq.lead?.businessName?.trim() || seq.lead?.title}
          />
          <span>· {seq.status}</span>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step sequenza</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {seq.steps.map((st) => (
            <div key={st.id} className="rounded-md border border-border/60 p-3">
              <p className="font-medium">
                Step {st.stepIndex + 1} · J+{st.delayDays} · {stepStatusLabel[st.status] ?? st.status}
                {st.subjectAlt || st.bodyAlt ? (
                  <span className="ml-2 rounded bg-muted px-1 text-[10px] font-normal">A/B</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {st.subject} · {dateFmt.format(st.scheduledFor)}
              </p>
              {st.status === "SCHEDULED" ? (
                <SequenceStepForm
                  stepId={st.id}
                  delayDays={st.delayDays}
                  subject={st.subject}
                  body={st.body}
                  subjectAlt={st.subjectAlt}
                  bodyAlt={st.bodyAlt}
                />
              ) : (
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{st.body}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
