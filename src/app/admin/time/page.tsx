import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { isFullAdmin } from "@/lib/auth-roles";
import { canFirstApproveTimeEntries } from "@/lib/time-approver";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeEntryForm } from "./time-entry-form";
import { TimeEntryDeleteButton } from "./time-entry-delete-button";
import { TimeEntryApproveButton } from "./time-entry-approve-button";
import { TimeErpPushButton } from "@/components/onizuka/time-erp-push-button";
import { TimeErpPullStatus } from "@/components/onizuka/time-erp-pull-status";
import { TimeCertifiedPushButtons } from "@/components/onizuka/time-certified-push-buttons";
import { ErpPartnerBadges } from "@/components/onizuka/erp-partner-badges";

export default async function AdminTimePage() {
  const session = await requireAdminArea();
  const admin = isFullAdmin(session.user.role);
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canApproveTimeEntries: true, role: true },
  });
  const canFirstApprove = me ? canFirstApproveTimeEntries(me.role, me.canApproveTimeEntries) : false;

  const [entries, clients, pendingApprovals, staffFirstQueue, lastErpPush] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: { workedAt: "desc" },
      take: 80,
      include: { client: { select: { companyName: true } } },
    }),
    prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    admin
      ? prisma.timeEntry.findMany({
          where: {
            OR: [{ approvedAt: null }, { secondApprovedAt: null }],
          },
          orderBy: { workedAt: "desc" },
          take: 60,
          include: {
            client: { select: { companyName: true } },
            owner: { select: { name: true, email: true } },
            approvedBy: { select: { email: true } },
          },
        })
      : Promise.resolve([]),
    !admin && canFirstApprove
      ? prisma.timeEntry.findMany({
          where: { approvedAt: null },
          orderBy: { workedAt: "desc" },
          take: 40,
          include: {
            client: { select: { companyName: true } },
            owner: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    prisma.timeErpPushLog.findFirst({
      where: { ownerUserId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalMinutes = entries.reduce((a, e) => a + e.minutes, 0);
  const fmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time tracking</h1>
        <p className="text-muted-foreground">
          Registro minuti, tariffa opzionale, commessa, fatturabile. Esporta CSV fino a 10.000 voci. Approvazione a{" "}
          <strong>due firme</strong> (1/2: admin o staff abilitato; 2/2: solo ADMIN distinto).
        </p>
        <div className="mt-3">
          <ErpPartnerBadges />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/admin/time/export">Esporta CSV</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/admin/time/export-erp">Export ERP generico</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/time/export-erp?vendor=zucchetti">Zucchetti</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/time/export-erp?vendor=teamsystem">TeamSystem</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/time/export-erp?vendor=sap">SAP</a>
          </Button>
          <TimeErpPushButton />
          <TimeErpPushButton vendor="zucchetti" />
          <TimeErpPushButton vendor="teamsystem" />
          <TimeCertifiedPushButtons />
          <Button asChild variant="outline" size="sm">
            <a href="/api/integrations/erp-oauth/connect?provider=zucchetti">OAuth Zucchetti</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/api/integrations/erp-oauth/connect?provider=sap">OAuth SAP</a>
          </Button>
        </div>
        {lastErpPush ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Ultimo push ERP: {fmt.format(lastErpPush.createdAt)} · {lastErpPush.vendor} · {lastErpPush.entryCount}{" "}
            voci · {lastErpPush.ok ? "OK" : `errore`}
          </p>
        ) : null}
        <TimeErpPullStatus />
      </div>

      {!admin && canFirstApprove && staffFirstQueue.length > 0 ? (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle>Da approvare (1/2)</CardTitle>
            <CardDescription>Voci in attesa della tua prima approvazione.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y">
              {staffFirstQueue.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt.format(e.workedAt)} · {e.minutes} min · {e.owner.email}
                    </p>
                  </div>
                  <TimeEntryApproveButton entryId={e.id} label="Approva (1/2)" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {admin && pendingApprovals.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Approvazioni ore (tutti gli utenti)</CardTitle>
            <CardDescription>
              Voci senza prima approvazione o in attesa della seconda (four-eyes: due ADMIN distinti).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="divide-y">
              {pendingApprovals.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt.format(e.workedAt)} · {e.minutes} min · {e.owner.email}
                      {e.owner.name ? ` (${e.owner.name})` : ""}
                      {e.client ? ` · ${e.client.companyName}` : ""}
                      {e.projectCode ? ` · commessa ${e.projectCode}` : ""}
                      {e.hourlyRateEur != null ? ` · €${e.hourlyRateEur.toString()}/h` : ""}
                      {e.billable ? "" : " · non fatt."}
                      {!e.approvedAt ? " · manca 1ª approvazione" : ""}
                      {e.approvedAt && !e.secondApprovedAt ? " · manca 2ª (altro admin)" : ""}
                    </p>
                  </div>
                  <TimeEntryApproveButton
                    entryId={e.id}
                    label={!e.approvedAt ? "Approva (1/2)" : "Approva (2/2)"}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nuova voce</CardTitle>
            <CardDescription>Cliente opzionale per allocazione su commessa.</CardDescription>
          </CardHeader>
          <CardContent>
            <TimeEntryForm clients={clients} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Le tue ultime voci</CardTitle>
            <CardDescription>
              Ultime {entries.length} voci · totale <strong>{totalMinutes}</strong> min (~
              {(totalMinutes / 60).toFixed(1)} h)
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {entries.length === 0 ? (
              <p className="text-muted-foreground">Nessuna voce ancora.</p>
            ) : (
              <ul className="divide-y">
                {entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt.format(e.workedAt)} · {e.minutes} min
                        {e.client ? ` · ${e.client.companyName}` : ""}
                        {e.projectCode ? ` · ${e.projectCode}` : ""}
                        {e.hourlyRateEur != null ? ` · €${e.hourlyRateEur.toString()}/h` : ""}
                        {e.billable ? "" : " · non fatturabile"}
                        {!e.approvedAt
                          ? " · in attesa 1ª approvazione"
                          : !e.secondApprovedAt
                            ? " · 1/2 — attesa seconda approvazione"
                            : " · approvata 2/2"}
                      </p>
                    </div>
                    <TimeEntryDeleteButton id={e.id} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="outline" size="sm">
        <Link href="/admin">← Command Center</Link>
      </Button>
    </div>
  );
}
