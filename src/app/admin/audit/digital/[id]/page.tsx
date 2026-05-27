import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { digitalAuditSectionLabel, digitalAuditStatusLabel } from "@/lib/digital-audit-labels";
import { formatGbpAuditSummary } from "@/lib/digital-audit-gbp-enrich";
import { isGbpPlacesApiConfigured } from "@/lib/gbp-places-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuditOutreachKitPanel } from "@/components/onizuka/audit-outreach-kit-panel";
import { publicReportPath } from "@/lib/public-report-token";

export default async function DigitalAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminArea();

  const { id } = await params;
  const audit = await prisma.digitalAudit.findFirst({
    where: { id, ownerUserId: session.user.id },
    include: {
      client: { select: { id: true, companyName: true } },
      lead: { select: { id: true, title: true, businessName: true } },
      recommendedBrand: true,
      recommendedService: true,
      sections: { orderBy: { sectionKey: "asc" } },
      outreachDrafts: { select: { id: true, status: true, subject: true } },
    },
  });

  if (!audit) notFound();

  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  const publicReportUrl = audit.publicReportToken
    ? `${baseUrl}${publicReportPath(audit.publicReportToken)}`
    : null;

  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeStyle: "short" });
  const gbpSummary = formatGbpAuditSummary(audit);

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/audit/digital">← Audit digitali</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{audit.businessName ?? "Audit digitale"}</h1>
        <p className="text-muted-foreground">
          {digitalAuditStatusLabel[audit.status]}
          {audit.overallScore != null ? ` · ${audit.overallScore}/100` : ""} · {dateFmt.format(audit.createdAt)}
          {gbpSummary ? ` · GBP: ${gbpSummary}` : ""}
          {!gbpSummary && !isGbpPlacesApiConfigured() ? " · GBP API non configurata" : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/audit/digital/${audit.id}/pdf?variant=internal`} download>
              PDF interno
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/admin/audit/digital/${audit.id}/pdf?variant=client`} download>
              PDF cliente
            </a>
          </Button>
          {audit.internalReportDriveUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={audit.internalReportDriveUrl} target="_blank" rel="noreferrer">
                Drive interno
              </a>
            </Button>
          ) : null}
          {audit.clientReportDriveUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={audit.clientReportDriveUrl} target="_blank" rel="noreferrer">
                Drive cliente
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Esito commerciale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Problema prioritario:</span>{" "}
              {audit.priorityProblem ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Brand consigliato:</span>{" "}
              {audit.recommendedBrand?.name ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Servizio consigliato:</span>{" "}
              {audit.recommendedService?.name ?? "—"}
            </p>
            {audit.client ? (
              <Button asChild variant="link" className="h-auto p-0">
                <Link href={`/admin/clients/${audit.client.id}`}>Scheda cliente · {audit.client.companyName}</Link>
              </Button>
            ) : null}
            {audit.lead ? (
              <Button asChild variant="link" className="h-auto p-0">
                <Link href={`/admin/crm/leads/${audit.lead.id}/edit`}>
                  Lead · {audit.lead.businessName ?? audit.lead.title}
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <AuditOutreachKitPanel
          auditId={audit.id}
          linkedInBody={audit.outreachLinkedInBody}
          callScript={audit.outreachCallScript}
          publicReportUrl={publicReportUrl}
          publicExpiresAt={audit.publicReportExpiresAt}
          drafts={audit.outreachDrafts}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Punteggi per sezione</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {audit.sections.map((s) => (
              <li key={s.id} className="rounded-md border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{digitalAuditSectionLabel[s.sectionKey]}</span>
                  <span className="tabular-nums font-bold">{s.score}/100</span>
                </div>
                {s.positives ? <p className="mt-1 text-xs text-muted-foreground">+ {s.positives}</p> : null}
                {s.issues ? <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{s.issues}</p> : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {audit.internalNotes ? (
        <Card>
          <CardHeader>
            <CardTitle>Note interne</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{audit.internalNotes}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
