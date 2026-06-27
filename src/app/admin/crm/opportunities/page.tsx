import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  opportunityPriorityLabel,
  opportunityPriorityOptions,
  opportunityStatusLabel,
  opportunityStatusOptions,
} from "@/lib/crm-opportunity";
import { buildListExportHref } from "@/lib/list-export-href";
import { buildOwnedOpportunityWhere, parseOpportunityListFilters } from "@/lib/opportunity-list-filters";
import { OpportunityQuickStatusForm } from "../opportunity-quick-status-form";
import { Select } from "@/components/ui/select";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminCrmOpportunitiesPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const ownerId = session.user.id;
  const filters = parseOpportunityListFilters(searchParams);

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.client.findMany({
        orderBy: { companyName: "asc" },
        select: { id: true, companyName: true },
      }),
      prisma.asset.findMany({
        orderBy: [{ client: { companyName: "asc" } }, { name: "asc" }],
        select: { id: true, name: true, client: { select: { companyName: true } } },
      }),
      prisma.opportunity.findMany({
        where: buildOwnedOpportunityWhere(ownerId, filters),
        include: {
          client: { select: { id: true, companyName: true } },
          lead: { select: { id: true, businessName: true, title: true } },
          asset: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="onizuka-page-title">CRM · Opportunità</h1>
          <p className="text-muted-foreground">Trattative commerciali per cliente.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [clients, assets, rows] = loaded.data;

  const pipelineParams = new URLSearchParams();
  if (filters.clientId) pipelineParams.set("clientId", filters.clientId);
  if (filters.priority) pipelineParams.set("priority", filters.priority);
  if (filters.assetId) pipelineParams.set("assetId", filters.assetId);
  if (filters.q) pipelineParams.set("q", filters.q);
  const pipelineHref =
    pipelineParams.size > 0 ? `/admin/crm/pipeline?${pipelineParams.toString()}` : "/admin/crm/pipeline";

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="onizuka-page-title">CRM · Opportunità</h1>
          <p className="text-muted-foreground">Trattative collegate ai clienti (valore, probabilità, next step).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href={buildListExportHref("/api/admin/crm/opportunities/export", {
                q: filters.q,
                status: filters.status ?? undefined,
                priority: filters.priority ?? undefined,
                clientId: filters.clientId,
                assetId: filters.assetId,
              })}
            >
              Esporta CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/crm/pipeline">Pipeline</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/crm/opportunities/new">Nuova opportunità</Link>
          </Button>
        </div>
      </div>

      <Card className="max-w-6xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>
            Stesso modello della pipeline: filtri via query string.{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href={pipelineHref}>
              Apri pipeline con gli stessi filtri (senza stato)
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
                Cliente
              </label>
              <Select
                id="clientId"
                name="clientId"
                defaultValue={filters.clientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
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
                {opportunityStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {opportunityStatusLabel[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label htmlFor="priority" className="text-xs font-medium text-muted-foreground">
                Priorità
              </label>
              <Select
                id="priority"
                name="priority"
                defaultValue={filters.priority ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutte</option>
                {opportunityPriorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {opportunityPriorityLabel[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-3">
              <label htmlFor="assetId" className="text-xs font-medium text-muted-foreground">
                Asset
              </label>
              <Select
                id="assetId"
                name="assetId"
                defaultValue={filters.assetId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.client.companyName} — {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Ricerca
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Titolo, cliente, asset, next step…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-1">
              <Button type="submit" className="w-full sm:w-auto">
                Applica
              </Button>
              <Button asChild type="button" variant="outline" className="w-full sm:w-auto">
                <Link href="/admin/crm/opportunities">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>
            {rows.length === 0 ? "Nessuna opportunità con questi filtri." : `${rows.length} opportunità.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Modifica i filtri o crea una nuova opportunità.</p>
          ) : (
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Titolo</th>
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Asset</th>
                  <th className="pb-2 pr-4 font-medium">Stato</th>
                  <th className="pb-2 pr-4 font-medium">Priorità</th>
                  <th className="pb-2 pr-4 font-medium">Valore €</th>
                  <th className="pb-2 pr-4 font-medium">Prob. %</th>
                  <th className="pb-2 text-right font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4 font-medium">{o.title}</td>
                    <td className="py-3 pr-4">
                      {o.client ? (
                        <Link className="text-primary hover:underline" href={`/admin/clients/${o.client.id}`}>
                          {o.client.companyName}
                        </Link>
                      ) : o.lead ? (
                        <Link
                          className="text-primary hover:underline"
                          href={`/admin/crm/leads/${o.lead.id}/edit`}
                        >
                          {o.lead.businessName ?? o.lead.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {o.asset && o.client ? (
                        <Link
                          className="text-primary hover:underline"
                          href={`/admin/clients/${o.client.id}/assets/${o.asset.id}/edit`}
                        >
                          {o.asset.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <OpportunityQuickStatusForm opportunityId={o.id} current={o.status} layout="table" />
                    </td>
                    <td className="py-3 pr-4">{opportunityPriorityLabel[o.priority]}</td>
                    <td className="py-3 pr-4">{o.estimatedValue != null ? String(o.estimatedValue) : "—"}</td>
                    <td className="py-3 pr-4">{o.probability != null ? o.probability : "—"}</td>
                    <td className="py-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/crm/opportunities/${o.id}/edit`}>Modifica</Link>
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
