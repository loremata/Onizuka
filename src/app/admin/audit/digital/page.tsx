import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { seedCommercialCatalog } from "@/lib/commercial-catalog-seed";
import { digitalAuditStatusLabel } from "@/lib/digital-audit-labels";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DigitalAuditStartForm } from "./digital-audit-start-form";
import { AuditDeleteButton } from "./audit-delete-button";
import { AuditSheetQueuePanel } from "@/components/onizuka/audit-sheet-queue-panel";
import { resolveAuditSheetCsvUrl } from "@/lib/audit-sheet-ingest";
import { isGoogleSheetsAuditApiConfigured } from "@/lib/google-sheets-audit";
import { ClientLink } from "@/components/onizuka/client-link";

export default async function DigitalAuditListPage() {
  const session = await requireAdminArea();

  try {
    await seedCommercialCatalog();
  } catch {
    return (
      <div className="space-y-8">
        <DbUnavailableBanner />
      </div>
    );
  }

  const [queuePending, queueFailed] = await Promise.all([
    prisma.auditSheetQueueItem.count({
      where: { ownerUserId: session.user.id, status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.auditSheetQueueItem.count({
      where: { ownerUserId: session.user.id, status: "FAILED" },
    }),
  ]);
  const sheetConfigured = Boolean(resolveAuditSheetCsvUrl()) || isGoogleSheetsAuditApiConfigured();

  const audits = await prisma.digitalAudit.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      client: { select: { id: true, companyName: true } },
      recommendedBrand: { select: { name: true } },
      recommendedService: { select: { name: true } },
    },
  });

  const dateFmt = dateTimeFormatIt({ dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/audit">← Audit</Link>
        </Button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Audit digitale</h1>
        <p className="text-muted-foreground">
          Protocollo marketing da P.IVA: punteggi per sezione, problema prioritario e bozza Reach opzionale.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coda Google Sheet (EP03)</CardTitle>
          <CardDescription>
            Importa righe P.IVA dal foglio configurato e elabora audit + outreach in batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditSheetQueuePanel pending={queuePending} failed={queueFailed} sheetConfigured={sheetConfigured} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nuovo audit</CardTitle>
          <CardDescription>Cerca cliente per P.IVA in anagrafica ed esegui analisi MVP.</CardDescription>
        </CardHeader>
        <CardContent>
          <DigitalAuditStartForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit completati</CardTitle>
          <CardDescription>{audits.length} recenti</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {audits.length === 0 ? (
            <p className="text-muted-foreground">Nessun audit ancora. Avvia il primo da P.IVA.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {audits.map((a) => (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link className="font-medium text-primary hover:underline" href={`/admin/audit/digital/${a.id}`}>
                      {a.businessName ?? a.vatNumber ?? "Audit"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {digitalAuditStatusLabel[a.status]}
                      {a.overallScore != null ? ` · ${a.overallScore}/100` : ""}
                      {a.recommendedBrand ? ` · ${a.recommendedBrand.name}` : ""}
                      {a.recommendedService ? ` — ${a.recommendedService.name}` : ""}
                    </p>
                    {a.priorityProblem ? <p className="mt-1 text-xs">{a.priorityProblem}</p> : null}
                    {a.client ? (
                      <p className="mt-1 text-xs">
                        <ClientLink clientId={a.client.id} name={a.client.companyName} />
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <time className="text-xs text-muted-foreground">{dateFmt.format(a.createdAt)}</time>
                    <AuditDeleteButton auditId={a.id} label={a.businessName ?? a.vatNumber ?? "Audit"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
