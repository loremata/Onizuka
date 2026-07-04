import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { leadStatusLabel, leadStatusOptions } from "@/lib/crm-lead-status";
import { commercialProspectStageLabel, commercialProspectStageOptions } from "@/lib/commercial-prospect-stage";
import { buildListExportHref } from "@/lib/list-export-href";
import { buildOwnedLeadWhere, parseLeadListFilters, LEADS_PAGE_SIZE } from "@/lib/lead-list-filters";
import { LeadQuickStatusForm } from "./lead-quick-status-form";
import { LeadCsvImportForm } from "@/components/onizuka/lead-csv-import-form";
import { Select } from "@/components/ui/select";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminCrmLeadsPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const ownerId = session.user.id;
  const filters = parseLeadListFilters(searchParams);
  const where = buildOwnedLeadWhere(ownerId, filters);
  const skip = (filters.page - 1) * LEADS_PAGE_SIZE;

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          convertedClient: { select: { id: true, companyName: true } },
          referrer: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: LEADS_PAGE_SIZE,
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where: { ownerUserId: ownerId },
        _count: { _all: true },
      }),
      prisma.referrer.findMany({
        where: { ownerUserId: ownerId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.lead.count({ where }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">CRM · Lead</h1>
          <p className="text-muted-foreground">Pipeline acquisizione.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [leads, statusCounts, referrers, total] = loaded.data;
  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + leads.length, total);

  // Costruisce una query string dai filtri correnti, con override (reset pagina su cambio filtro).
  const qs = (overrides: Record<string, string | undefined> = {}) => {
    const base: Record<string, string | undefined> = {
      q: filters.q || undefined,
      status: filters.status ?? undefined,
      stage: filters.stage ?? undefined,
      referrerId: filters.referrerId ?? undefined,
      source: filters.source ?? undefined,
      city: filters.city ?? undefined,
      hasWebsite: filters.hasWebsite === true ? "si" : filters.hasWebsite === false ? "no" : undefined,
      page: filters.page > 1 ? String(filters.page) : undefined,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="onizuka-page-title">CRM · Lead</h1>
          <p className="text-muted-foreground">Database prospect: filtrabile per stato, stage audit, comune, città, sito.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href={buildListExportHref("/api/admin/crm/leads/export", {
                q: filters.q,
                status: filters.status ?? undefined,
                referrerId: filters.referrerId ?? undefined,
              })}
            >
              Esporta CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/scraping">Scraping aziende</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/leads/quick">Lead banco</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/analytics">Analytics</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/crm/leads/new">Nuovo lead</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {statusCounts.map((row) => (
          <Link
            key={row.status}
            href={`/admin/crm/leads${qs({ status: row.status, page: undefined })}`}
            className={`rounded-md border px-3 py-1.5 text-xs hover:bg-muted/50 ${filters.status === row.status ? "border-primary bg-primary/10" : "border-border/60"}`}
          >
            {leadStatusLabel[row.status]}: <strong>{row._count._all}</strong>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>Query GET, condivisibile via URL. I filtri si combinano.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">Testo (azienda, P.IVA, email…)</label>
              <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Cerca…"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">Stato</label>
              <Select id="status" name="status" defaultValue={filters.status ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Tutti</option>
                {leadStatusOptions.map((s) => <option key={s} value={s}>{leadStatusLabel[s]}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="stage" className="text-xs font-medium text-muted-foreground">Stage audit</label>
              <Select id="stage" name="stage" defaultValue={filters.stage ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Tutti</option>
                {commercialProspectStageOptions.map((s) => <option key={s} value={s}>{commercialProspectStageLabel[s]}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="source" className="text-xs font-medium text-muted-foreground">Origine / comune (es. scraping, Rosignano)</label>
              <input id="source" name="source" defaultValue={filters.source ?? ""} placeholder="scraping…"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="city" className="text-xs font-medium text-muted-foreground">Città</label>
              <input id="city" name="city" defaultValue={filters.city ?? ""} placeholder="Città…"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="hasWebsite" className="text-xs font-medium text-muted-foreground">Sito web</label>
              <Select id="hasWebsite" name="hasWebsite" defaultValue={filters.hasWebsite === true ? "si" : filters.hasWebsite === false ? "no" : ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Tutti</option>
                <option value="si">Ha sito</option>
                <option value="no">Senza sito</option>
              </Select>
            </div>
            {referrers.length > 0 && (
              <div className="flex flex-col gap-1">
                <label htmlFor="referrerId" className="text-xs font-medium text-muted-foreground">Segnalatore</label>
                <Select id="referrerId" name="referrerId" defaultValue={filters.referrerId ?? ""} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Tutti</option>
                  {referrers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline"><Link href="/admin/crm/leads">Azzera</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Import CSV</CardTitle>
          <CardDescription>Import CSV lead da foglio o export CRM.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadCsvImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco lead</CardTitle>
          <CardDescription>
            {total === 0 ? "Nessun lead con questi filtri." : `${from}–${to} di ${total} · pagina ${filters.page}/${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun risultato: usa &quot;Nuovo lead&quot; o allarga i filtri.</p>
          ) : (
            <>
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Azienda</th>
                    <th className="pb-2 pr-4 font-medium">Stato</th>
                    <th className="pb-2 pr-4 font-medium">Stage audit</th>
                    <th className="pb-2 pr-4 font-medium">Città</th>
                    <th className="pb-2 pr-4 font-medium">Sito</th>
                    <th className="pb-2 pr-4 font-medium">Origine</th>
                    <th className="pb-2 pr-4 font-medium">Conversione</th>
                    <th className="pb-2 text-right font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{l.businessName || l.title}</div>
                        {(l.contactName || l.vatNumber) && (
                          <div className="text-xs text-muted-foreground">{[l.contactName, l.vatNumber].filter(Boolean).join(" · ")}</div>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <LeadQuickStatusForm leadId={l.id} current={l.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {l.commercialProspectStage ? commercialProspectStageLabel[l.commercialProspectStage] : "—"}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{l.city || "—"}</td>
                      <td className="py-3 pr-4">
                        {l.website ? (
                          <a className="text-primary hover:underline" href={l.website} target="_blank" rel="noopener noreferrer">sito</a>
                        ) : (
                          <span className="text-amber-600">senza</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{l.source || "—"}</td>
                      <td className="py-3 pr-4">
                        {l.convertedClient ? (
                          <Link className="text-primary hover:underline" href={`/admin/clients/${l.convertedClient.id}`}>{l.convertedClient.companyName}</Link>
                        ) : "—"}
                      </td>
                      <td className="py-3 text-right">
                        <Button asChild variant="outline" size="sm"><Link href={`/admin/crm/leads/${l.id}/edit`}>Apri</Link></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{from}–{to} di {total}</span>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" disabled={filters.page <= 1}>
                      <Link href={`/admin/crm/leads${qs({ page: filters.page > 2 ? String(filters.page - 1) : undefined })}`}>← Precedente</Link>
                    </Button>
                    <span className="px-2 py-1.5 text-muted-foreground">{filters.page}/{totalPages}</span>
                    <Button asChild variant="outline" size="sm" disabled={filters.page >= totalPages}>
                      <Link href={`/admin/crm/leads${qs({ page: String(filters.page + 1) })}`}>Successiva →</Link>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
