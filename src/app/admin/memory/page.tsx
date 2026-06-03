import { dateTimeFormatIt } from "@/lib/datetime-it";
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
import { MemoryExportButtons } from "@/components/onizuka/memory-export-buttons";
import { isEmbeddingConfigured } from "@/lib/llm-client";
import { countMemoryEmbeddingStats } from "@/lib/memory-reindex";
import { buildOwnedMemoryWhere, MEMORY_SCOPE_FILTER_OPTIONS, parseMemoryListFilters } from "@/lib/memory-list-filters";
import { MemoryReindexButton } from "./memory-reindex-button";
import { MemoryVaultBanner } from "@/components/onizuka/memory-vault-banner";

const scopeLabel: Record<string, string> = {
  PERSONAL: "Personale",
  BUSINESS: "Business",
  ASSET: "Asset",
  CLIENT: "Cliente",
  EPISODIC: "Episodica",
  DOCUMENTAL: "Documentale",
  SENSITIVE: "Sensibile",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminMemoryListPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const listFilters = parseMemoryListFilters(searchParams);

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.memoryItem.findMany({
        where: buildOwnedMemoryWhere(session.user.id, listFilters),
        include: { client: { select: { id: true, companyName: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.client.findMany({
        orderBy: { companyName: "asc" },
        select: { id: true, companyName: true },
      }),
      countMemoryEmbeddingStats(session.user.id),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memoria</h1>
          <p className="text-muted-foreground">Voci di memoria persistente.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [items, clients, embeddingStats] = loaded.data;
  const embeddingsEnabled = isEmbeddingConfigured();
  const encryptedCount = items.filter((m) => m.contentEncrypted).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Onizuka Memory</h1>
          <p className="text-muted-foreground">
            Memoria persistente manuale: contesto per CRM, Flow e assistente (MVP 1). Filtri opzionali via query GET.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MemoryExportButtons
            q={listFilters.q}
            scope={listFilters.scope ?? undefined}
            clientId={listFilters.clientId}
          />
          <Button asChild>
            <Link href="/admin/memory/new">Nuova voce</Link>
          </Button>
        </div>
      </div>

      <MemoryVaultBanner encryptedCount={encryptedCount} />

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">RAG semantico</CardTitle>
          <CardDescription>
            {embeddingStats.withEmbedding}/{embeddingStats.total} voci con embedding · pgvector se extension attiva ·
            memoria HIGH cifrata con ONIZUKA_MEMORY_ENCRYPTION_KEY.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MemoryReindexButton embeddingsEnabled={embeddingsEnabled} />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>
            Ricerca in titolo, contenuto, cliente collegato; tag con match esatto sul testo cercato.
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
                defaultValue={listFilters.q}
                placeholder="Cerca…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex min-w-[200px] flex-col gap-1">
              <label htmlFor="scope" className="text-xs font-medium text-muted-foreground">
                Ambito
              </label>
              <select
                id="scope"
                name="scope"
                defaultValue={listFilters.scope ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {MEMORY_SCOPE_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {scopeLabel[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[200px] flex-col gap-1">
              <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
                Cliente
              </label>
              <select
                id="clientId"
                name="clientId"
                defaultValue={listFilters.clientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/memory">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Elenco voci</CardTitle>
          <CardDescription>
            {items.length === 0
              ? listFilters.q || listFilters.scope || listFilters.clientId
                ? "Nessuna voce con questi filtri."
                : "Nessuna memoria ancora. Aggiungi una voce o esegui il seed."
              : `${items.length} voci.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {listFilters.q || listFilters.scope || listFilters.clientId
                ? "Modifica i filtri o usa «Azzera»."
                : "Usa &quot;Nuova voce&quot; per creare la prima memoria."}
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Titolo</th>
                  <th className="pb-2 pr-4 font-medium">Ambito</th>
                  <th className="pb-2 pr-4 font-medium">Cliente</th>
                  <th className="pb-2 pr-4 font-medium">Aggiornato</th>
                  <th className="pb-2 text-right font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium">{m.title}</div>
                      {m.tags.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">{m.tags.join(" · ")}</p>
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top whitespace-nowrap">
                      {scopeLabel[m.scope] ?? m.scope}
                      {m.sensitivity === "HIGH" && (
                        <span className="ml-2 rounded bg-destructive/20 px-1.5 py-0.5 text-xs">Alta sens.</span>
                      )}
                      {m.contentEncrypted ? (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-xs">Vault</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 align-top">
                      {m.client ? (
                        <Link className="text-primary hover:underline" href={`/admin/clients/${m.client.id}`}>
                          {m.client.companyName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 align-top whitespace-nowrap text-muted-foreground">
                      {dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" }).format(m.updatedAt)}
                    </td>
                    <td className="py-3 text-right align-top">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/memory/${m.id}/edit`}>Modifica</Link>
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
