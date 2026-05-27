import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  opportunityPriorityLabel,
  opportunityPriorityOptions,
} from "@/lib/crm-opportunity";
import { buildOwnedOpportunityWhere, parseOpportunityListFilters } from "@/lib/opportunity-list-filters";
import { PipelineBoard } from "./pipeline-board";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminCrmPipelinePage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const ownerId = session.user.id;
  const filters = parseOpportunityListFilters(searchParams);

  const clients = await prisma.client.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });

  const assetWhere = filters.clientId ? { clientId: filters.clientId } : {};
  const assets = await prisma.asset.findMany({
    where: assetWhere,
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, client: { select: { companyName: true } } },
  });

  const where = buildOwnedOpportunityWhere(ownerId, {
    ...filters,
    status: null,
  });

  const all = await prisma.opportunity.findMany({
    where,
    include: {
      client: { select: { id: true, companyName: true } },
      lead: { select: { id: true, businessName: true, title: true } },
      asset: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const tableParams = new URLSearchParams();
  if (filters.clientId) tableParams.set("clientId", filters.clientId);
  if (filters.priority) tableParams.set("priority", filters.priority);
  if (filters.assetId) tableParams.set("assetId", filters.assetId);
  if (filters.q) tableParams.set("q", filters.q);
  const opportunitiesTableHref =
    tableParams.size > 0 ? `/admin/crm/opportunities?${tableParams.toString()}` : "/admin/crm/opportunities";

  const boardData = all.map((o) => ({
    id: o.id,
    title: o.title,
    status: o.status,
    clientId: o.client?.id ?? "",
    clientName: o.client?.companyName ?? o.lead?.businessName ?? o.lead?.title ?? "Prospect",
    assetName: o.asset?.name ?? null,
    estimatedValue: o.estimatedValue != null ? String(o.estimatedValue) : null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM · Pipeline opportunità</h1>
        <p className="text-muted-foreground">
          Vista per stato delle trattative. Trascina dalla maniglia ⋮⋮ per spostare tra colonne, oppure usa il menu
          stato su ogni card. Scheda completa da{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href="/admin/crm/opportunities">
            Opportunità
          </Link>
          .
        </p>
      </div>

      <Card className="max-w-5xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>
            Cliente, priorità, asset, ricerca su titolo / cliente / asset / next step (query GET, condivisibile via URL).
            Stato resta suddiviso per
            colonna.{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href={opportunitiesTableHref}>
              Vista tabella con gli stessi filtri
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-1 lg:col-span-3">
              <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
                Cliente
              </label>
              <select
                id="clientId"
                name="clientId"
                defaultValue={filters.clientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti i clienti</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label htmlFor="priority" className="text-xs font-medium text-muted-foreground">
                Priorità
              </label>
              <select
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
              </select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-3">
              <label htmlFor="assetId" className="text-xs font-medium text-muted-foreground">
                Asset
              </label>
              <select
                id="assetId"
                name="assetId"
                defaultValue={filters.assetId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti gli asset</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.client.companyName} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
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
                <Link href="/admin/crm/pipeline">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PipelineBoard opportunities={boardData} />
    </div>
  );
}
