import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { ADMIN_AUDIT_ACTION_LABELS, loadAdminAuditLog, parseAuditDateParam } from "@/lib/admin-audit-log";
import { loadRecentActivity } from "@/lib/activity-feed";
import { AuditDateFilter } from "./audit-date-filter";
import { AuditLogToolbar } from "./audit-log-toolbar";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VatLookup } from "./vat-lookup";

const PAGE_SIZE = 30;

const kindLabel: Record<string, string> = {
  post: "Contenuto",
  flow: "Flow",
  opportunity: "Opportunità",
  lead: "Lead",
  comment: "Commento",
};

type SearchParams = { action?: string; entity?: string; page?: string; from?: string; to?: string; actor?: string };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAdminArea();

  const params = await searchParams;
  const actionFilter = params.action?.trim() || undefined;
  const entityFilter = params.entity?.trim() || undefined;
  const fromStr = params.from?.trim() || undefined;
  const toStr = params.to?.trim() || undefined;
  const actorFilter = params.actor?.trim() || undefined;
  const page = Math.max(0, Number(params.page ?? "0") || 0);
  const from = parseAuditDateParam(fromStr);
  const to = parseAuditDateParam(toStr, true);

  const [feed, securityLog] = await Promise.all([
    loadRecentActivity(session.user.id, 30),
    loadAdminAuditLog({
      limit: PAGE_SIZE,
      skip: page * PAGE_SIZE,
      action: actionFilter,
      entityType: entityFilter,
      from,
      to,
      actor: actorFilter,
    }),
  ]);
  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  if (!feed.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">Audit log &amp; attività</h1>
          <p className="text-muted-foreground">Registro attività cross-modulo (MVP).</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const toolbarFilters = {
    action: actionFilter,
    entity: entityFilter,
    from: fromStr,
    to: toStr,
    actor: actorFilter,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="onizuka-page-title">Audit log &amp; attività</h1>
        <p className="text-muted-foreground">
          Timeline operativa, log sicurezza con filtri data/attore ed export CSV.
        </p>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>Audit digitale marketing</CardTitle>
          <CardDescription>
            Protocollo completo: punteggi per sezione, servizio consigliato, bozza Reach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/admin/audit/digital">Apri audit digitali</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit da P.IVA (lookup rapido)</CardTitle>
          <CardDescription>Collega anagrafica cliente e score operativo (asset, CRM, opportunità).</CardDescription>
        </CardHeader>
        <CardContent>
          <VatLookup />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log azioni admin</CardTitle>
          <CardDescription>CRM, memoria, post, webhook, utenti, login falliti, preventivi e ticket.</CardDescription>
        </CardHeader>
        <CardContent>
          {!securityLog.ok ? (
            <p className="text-sm text-muted-foreground">Log non disponibile (database offline).</p>
          ) : (
            <>
              <Suspense fallback={<p className="text-xs text-muted-foreground">Caricamento filtri…</p>}>
                <AuditDateFilter filters={{ action: actionFilter, entity: entityFilter }} />
              </Suspense>
              <AuditLogToolbar
                filters={toolbarFilters}
                page={page}
                total={securityLog.total}
                pageSize={PAGE_SIZE}
              />
              {securityLog.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessuna azione per questo filtro.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {securityLog.entries.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap gap-x-2 gap-y-1 border-b border-border/40 pb-3 last:border-0"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{dateFmt.format(e.at)}</span>
                      <span className="rounded bg-primary/10 px-1.5 text-xs text-primary">
                        {ADMIN_AUDIT_ACTION_LABELS[e.action] ?? e.action}
                      </span>
                      <span className="font-medium">{e.summary}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.actorName ?? e.actorEmail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attività recente</CardTitle>
          <CardDescription>Ultimi 30 eventi ordinati per data di aggiornamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {feed.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna attività registrata.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {feed.entries.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-2 gap-y-1 border-b border-border/40 pb-3 last:border-0">
                  <span className="font-mono text-xs text-muted-foreground">{dateFmt.format(e.at)}</span>
                  <span className="rounded bg-muted px-1.5 text-xs">{kindLabel[e.kind] ?? e.kind}</span>
                  <Link className="font-medium text-primary hover:underline" href={e.href}>
                    {e.title}
                  </Link>
                  <span className="text-muted-foreground">{e.subtitle}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
