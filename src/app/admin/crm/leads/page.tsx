import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { leadStatusLabel, leadStatusOptions } from "@/lib/crm-lead-status";
import { buildListExportHref } from "@/lib/list-export-href";
import { buildOwnedLeadWhere, parseLeadListFilters } from "@/lib/lead-list-filters";
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

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.lead.findMany({
        where: buildOwnedLeadWhere(ownerId, filters),
        include: {
          convertedClient: { select: { id: true, companyName: true } },
          referrer: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
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

  const [leads, statusCounts, referrers] = loaded.data;

  let referrerLabel: string | null = null;
  if (filters.referrerId) {
    const rf = await prisma.referrer.findFirst({
      where: { id: filters.referrerId, ownerUserId: ownerId },
      select: { name: true },
    });
    referrerLabel = rf?.name ?? null;
  }

  const leadQueryWithoutReferrer = (() => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.status) p.set("status", filters.status);
    const s = p.toString();
    return s ? `?${s}` : "";
  })();

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="onizuka-page-title">CRM · Lead</h1>
          <p className="text-muted-foreground">Pipeline acquisizione prima della conversione in cliente.</p>
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

      {filters.referrerId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span>
            Filtro segnalatore:{" "}
            <strong>{referrerLabel ?? "— (non trovato o rimosso)"}</strong>
          </span>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/crm/leads${leadQueryWithoutReferrer}`}>Rimuovi filtro</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {statusCounts.map((row) => (
          <Link
            key={row.status}
            href={`/admin/crm/leads?status=${row.status}${filters.referrerId ? `&referrerId=${encodeURIComponent(filters.referrerId)}` : ""}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}`}
            className="rounded-md border border-border/60 px-3 py-1.5 text-xs hover:bg-muted/50"
          >
            {leadStatusLabel[row.status]}: <strong>{row._count._all}</strong>
          </Link>
        ))}
      </div>

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>Ricerca testuale e stato (query GET, condivisibile via URL).</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Testo (titolo, azienda, contatto, email…)
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Cerca…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[180px] flex-col gap-1">
              <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
                Stato
              </label>
              <Select
                id="status"
                name="status"
                defaultValue={filters.status ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {leadStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {leadStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex min-w-[200px] flex-col gap-1">
              <label htmlFor="referrerId" className="text-xs font-medium text-muted-foreground">
                Segnalatore
              </label>
              <Select
                id="referrerId"
                name="referrerId"
                defaultValue={filters.referrerId ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {referrers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/crm/leads">Azzera</Link>
              </Button>
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
            {leads.length === 0
              ? "Nessun lead con questi filtri. Aggiungi il primo o modifica la ricerca."
              : `${leads.length} lead.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Usa &quot;Nuovo lead&quot; o allarga i filtri.</p>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Titolo</th>
                  <th className="pb-2 pr-4 font-medium">Stato</th>
                  <th className="pb-2 pr-4 font-medium">Azienda / contatto</th>
                  <th className="pb-2 pr-4 font-medium">Segnalatore</th>
                  <th className="pb-2 pr-4 font-medium">Conversione</th>
                  <th className="pb-2 text-right font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4 font-medium">{l.title}</td>
                    <td className="py-3 pr-4 align-top">
                      <LeadQuickStatusForm leadId={l.id} current={l.status} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {[l.businessName, l.contactName].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {l.referrer ? (
                        <Link className="text-primary hover:underline" href={`/admin/crm/leads?referrerId=${l.referrer.id}`}>
                          {l.referrer.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {l.convertedClient ? (
                        <Link className="text-primary hover:underline" href={`/admin/clients/${l.convertedClient.id}`}>
                          {l.convertedClient.companyName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/crm/leads/${l.id}/edit`}>Modifica</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
