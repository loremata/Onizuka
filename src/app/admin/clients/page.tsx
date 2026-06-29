import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientDeleteButton } from "./client-delete-button";
import { clientStatusLabel } from "@/lib/crm-client-status";
import { clientKindBadge, clientKindLabel, clientMacroCategoryLabel } from "@/lib/client-kind";
import { buildClientSearchWhere, parseClientListFilters } from "@/lib/client-list-filters";
import { clientWorkspaceWhere, getScopedPrisma } from "@/lib/workspace-scope";
import { WorkspaceSwitcher } from "@/components/onizuka/workspace-switcher";
import { Select } from "@/components/ui/select";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

const relLabel: Record<string, string> = { LEAD: "Prospect", CLIENTE: "Cliente", EX_CLIENTE: "Ex cliente" };
const relClass: Record<string, string> = {
  LEAD: "bg-amber-500/15 text-amber-600",
  CLIENTE: "bg-success/15 text-success",
  EX_CLIENTE: "bg-muted text-muted-foreground",
};

export default async function AdminClientsPage({ searchParams }: Props) {
  const [wsWhere, db] = await Promise.all([clientWorkspaceWhere(undefined), getScopedPrisma()]);
  const filters = parseClientListFilters(searchParams);
  // Anagrafica unificata: senza filtro esplicito mostra clienti + prospect (non gli ex).
  if (searchParams.state == null) filters.state = "active";
  const searchWhere = buildClientSearchWhere(filters);

  const loaded = await runWithDb(() =>
    db.client.findMany({
      where: { ...searchWhere, ...wsWhere },
      orderBy: { companyName: "asc" },
      include: { _count: { select: { users: true, posts: true } } },
    })
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="onizuka-page-title">Clienti</h1>
          <p className="onizuka-page-lead">Privati e aziende · servizi negozio e digitale/AI.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const allClients = loaded.data;

  // Spesa mensile gestita per cliente (somma canoni contratti ATTIVI) + filtro spesa minima.
  const spendRows = allClients.length
    ? await prisma.clientRetailContract.groupBy({
        by: ["clientId"],
        where: { clientId: { in: allClients.map((c) => c.id) }, status: "ACTIVE" },
        _sum: { monthlyEur: true },
      })
    : [];
  const spendByClient = new Map<string, number>(
    spendRows.map((r) => [r.clientId, r._sum.monthlyEur ? Number(r._sum.monthlyEur.toString()) : 0]),
  );
  const clients = filters.minSpend
    ? allClients.filter((c) => (spendByClient.get(c.id) ?? 0) >= filters.minSpend!)
    : allClients;

  const retailFilterActive =
    Boolean(filters.operator) || filters.hasKinds.length > 0 || filters.minSpend != null;

  const HAS_KINDS: { value: string; label: string }[] = [
    { value: "MOBILE", label: "Mobile" },
    { value: "FIBER", label: "Fibra" },
    { value: "ENERGY", label: "Luce" },
    { value: "GAS", label: "Gas" },
    { value: "SKY", label: "Sky" },
    { value: "TELEPASS", label: "Telepass" },
  ];

  const emptyMessage =
    (filters.q || retailFilterActive) && clients.length === 0
      ? "Nessun cliente corrisponde ai filtri. Prova a modificarli o azzerali."
      : "Nessun cliente ancora. Creane uno per iniziare.";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="onizuka-page-title">Clienti</h1>
          <p className="onizuka-page-lead">Privati e aziende · servizi negozio e digitale/AI.</p>
          <WorkspaceSwitcher />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/crm/database">Database / Segmenti</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/clients/new">Nuovo cliente</Link>
          </Button>
        </div>
      </div>

      <Card className="max-w-5xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ricerca & targeting</CardTitle>
          <CardDescription>
            Testo, tipo, macro — e targeting promo: operatore, servizi attivi e spesa mensile gestita.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Testo
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="Cerca cliente…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[150px] flex-col gap-1">
              <label htmlFor="state" className="text-xs font-medium text-muted-foreground">
                Stato
              </label>
              <Select
                id="state"
                name="state"
                defaultValue={filters.state}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="active">Attivi (clienti + prospect)</option>
                <option value="CLIENTE">Solo clienti</option>
                <option value="LEAD">Solo prospect / lead</option>
                <option value="EX_CLIENTE">Ex clienti</option>
                <option value="all">Tutti</option>
              </Select>
            </div>
            <div className="flex min-w-[140px] flex-col gap-1">
              <label htmlFor="kind" className="text-xs font-medium text-muted-foreground">
                Tipo
              </label>
              <Select
                id="kind"
                name="kind"
                defaultValue={filters.kind}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                <option value="PRIVATE">Privato</option>
                <option value="BUSINESS">Azienda</option>
              </Select>
            </div>
            <div className="flex min-w-[160px] flex-col gap-1">
              <label htmlFor="macro" className="text-xs font-medium text-muted-foreground">
                Macro
              </label>
              <Select
                id="macro"
                name="macro"
                defaultValue={filters.macro}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutte</option>
                <option value="RETAIL_STORE">Negozio</option>
                <option value="DIGITAL_AI">Digitale / AI</option>
                <option value="MIXED">Misto</option>
              </Select>
            </div>
            <div className="flex min-w-[150px] flex-col gap-1">
              <label htmlFor="operator" className="text-xs font-medium text-muted-foreground">
                Operatore
              </label>
              <input
                id="operator"
                name="operator"
                type="text"
                defaultValue={filters.operator}
                placeholder="Es. Fastweb"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[120px] flex-col gap-1">
              <label htmlFor="minSpend" className="text-xs font-medium text-muted-foreground">
                Spesa ≥ (€/mese)
              </label>
              <input
                id="minSpend"
                name="minSpend"
                type="number"
                min="0"
                step="0.01"
                defaultValue={filters.minSpend ?? ""}
                placeholder="39"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex w-full flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Ha attivi con noi (tutti)</span>
              <div className="flex flex-wrap gap-3">
                {HAS_KINDS.map((k) => (
                  <label key={k.value} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="has"
                      value={k.value}
                      defaultChecked={filters.hasKinds.includes(k.value as (typeof filters.hasKinds)[number])}
                      className="rounded"
                    />
                    {k.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/clients">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco clienti</CardTitle>
          <CardDescription>
            Crea, modifica o elimina clienti. Eliminando un cliente vengono rimossi tutti i suoi post e webhook; gli
            account utente vengono scollegati.
            {filters.q || retailFilterActive
              ? ` Filtro attivo: ${clients.length} risultat${clients.length === 1 ? "o" : "i"}.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Stato</th>
                    <th className="pb-3 font-medium">Tipo</th>
                    <th className="pb-3 font-medium">Ragione sociale</th>
                    <th className="hidden pb-3 font-medium md:table-cell">Slug</th>
                    <th className="pb-3 font-medium">Email di contatto</th>
                    <th className="pb-3 font-medium text-right">Spesa/mese</th>
                    <th className="hidden pb-3 font-medium md:table-cell">Utenti</th>
                    <th className="hidden pb-3 font-medium md:table-cell">Post</th>
                    <th className="pb-3 font-medium text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${relClass[c.relationshipState] ?? ""}`}
                        >
                          {relLabel[c.relationshipState] ?? c.relationshipState}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">{clientStatusLabel[c.status]}</span>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {clientKindLabel[clientKindBadge(c)]}
                        {c.clientMacroCategory
                          ? ` · ${clientMacroCategoryLabel[c.clientMacroCategory]}`
                          : ""}
                      </td>
                      <td className="py-3">
                        <Link href={`/admin/clients/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.companyName}
                        </Link>
                      </td>
                      <td className="hidden py-3 font-mono text-muted-foreground md:table-cell">{c.slug}</td>
                      <td className="py-3">{c.contactEmail}</td>
                      <td className="py-3 text-right tabular-nums">
                        {spendByClient.get(c.id)
                          ? `€ ${spendByClient.get(c.id)!.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="hidden py-3 md:table-cell">{c._count.users}</td>
                      <td className="hidden py-3 md:table-cell">{c._count.posts}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/admin/clients/${c.id}`}>Scheda</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/clients/${c.id}/edit`}>Modifica</Link>
                          </Button>
                          <ClientDeleteButton clientId={c.id} companyName={c.companyName} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
