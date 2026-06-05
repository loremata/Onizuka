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

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminClientsPage({ searchParams }: Props) {
  const [wsWhere, db] = await Promise.all([clientWorkspaceWhere(undefined), getScopedPrisma()]);
  const filters = parseClientListFilters(searchParams);
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

  const clients = loaded.data;

  const emptyMessage =
    filters.q && clients.length === 0
      ? "Nessun cliente corrisponde alla ricerca. Prova altre parole chiave o azzera i filtri."
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

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ricerca</CardTitle>
          <CardDescription>
            Filtra per ragione sociale, slug, email, città, P.IVA, telefono, sito, indirizzo, note o referenti.
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
            <div className="flex min-w-[140px] flex-col gap-1">
              <label htmlFor="kind" className="text-xs font-medium text-muted-foreground">
                Tipo
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue={filters.kind}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                <option value="PRIVATE">Privato</option>
                <option value="BUSINESS">Azienda</option>
              </select>
            </div>
            <div className="flex min-w-[160px] flex-col gap-1">
              <label htmlFor="macro" className="text-xs font-medium text-muted-foreground">
                Macro
              </label>
              <select
                id="macro"
                name="macro"
                defaultValue={filters.macro}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutte</option>
                <option value="RETAIL_STORE">Negozio</option>
                <option value="DIGITAL_AI">Digitale / AI</option>
                <option value="MIXED">Misto</option>
              </select>
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
            {filters.q ? ` Filtro attivo: ${clients.length} risultat${clients.length === 1 ? "o" : "i"}.` : ""}
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
                    <th className="pb-3 font-medium">Slug</th>
                    <th className="pb-3 font-medium">Email di contatto</th>
                    <th className="pb-3 font-medium">Utenti</th>
                    <th className="pb-3 font-medium">Post</th>
                    <th className="pb-3 font-medium text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3 text-sm text-muted-foreground">{clientStatusLabel[c.status]}</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {clientKindLabel[clientKindBadge(c)]}
                        {c.clientMacroCategory
                          ? ` · ${clientMacroCategoryLabel[c.clientMacroCategory]}`
                          : ""}
                      </td>
                      <td className="py-3">{c.companyName}</td>
                      <td className="py-3 font-mono text-muted-foreground">{c.slug}</td>
                      <td className="py-3">{c.contactEmail}</td>
                      <td className="py-3">{c._count.users}</td>
                      <td className="py-3">{c._count.posts}</td>
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
