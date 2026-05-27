import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { digitalAuditSectionLabel, digitalAuditStatusLabel } from "@/lib/digital-audit-labels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PublicAuditReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const audit = await prisma.digitalAudit.findFirst({
    where: { publicReportToken: token },
    include: {
      sections: { orderBy: { sectionKey: "asc" } },
      recommendedBrand: { select: { name: true } },
      recommendedService: { select: { name: true } },
    },
  });

  if (!audit) notFound();
  if (audit.publicReportExpiresAt && audit.publicReportExpiresAt < new Date()) {
    return (
      <main className="container mx-auto max-w-2xl py-16 px-4 text-center">
        <h1 className="text-xl font-semibold">Report scaduto</h1>
        <p className="mt-2 text-muted-foreground">Richiedi un nuovo link al referente Onizuka.</p>
      </main>
    );
  }

  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "long" });

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl space-y-6 py-10 px-4">
        <header className="space-y-1 border-b pb-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Report digitale · Onizuka</p>
          <h1 className="text-2xl font-bold">{audit.businessName ?? "La tua azienda"}</h1>
          <p className="text-sm text-muted-foreground">
            {digitalAuditStatusLabel[audit.status]}
            {audit.overallScore != null ? ` · Punteggio ${audit.overallScore}/100` : ""} · {dateFmt.format(audit.createdAt)}
          </p>
        </header>

        {audit.priorityProblem ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunità prioritaria</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{audit.priorityProblem}</CardContent>
          </Card>
        ) : null}

        {(audit.recommendedBrand || audit.recommendedService) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Percorso consigliato</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {[audit.recommendedBrand?.name, audit.recommendedService?.name].filter(Boolean).join(" — ")}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Punteggi per area</CardTitle>
            <CardDescription>Sintesi non vincolante — per approfondimenti contatta Onizuka.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {audit.sections.map((s) => (
                <li key={s.id} className="flex justify-between gap-4 border-b border-border/50 py-2 last:border-0">
                  <span>{digitalAuditSectionLabel[s.sectionKey]}</span>
                  <span className="font-semibold tabular-nums">{s.score}/100</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Documento generato automaticamente. Dati interni e note operative non sono inclusi.
        </p>
      </div>
    </main>
  );
}
