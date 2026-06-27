import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { runWithDb } from "@/lib/with-db";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildWebhookListWhere, parseWebhookListFilters } from "@/lib/webhook-list-filters";
import type { WebhookEvent } from "@prisma/client";
import { WebhookForm } from "./webhook-form";
import { WebhookDeliveriesPanel } from "./webhook-deliveries-panel";
import { WebhookFailuresPanel } from "./webhook-failures-panel";
import { WebhookTestButton } from "./webhook-test-button";
import { WebhookToggleButton } from "./webhook-toggle-button";
import { Select } from "@/components/ui/select";

const eventLabel: Record<WebhookEvent, string> = {
  POST_APPROVED: "Post approvato",
  POST_STATUS_CHANGED: "Stato post modificato",
};

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminWebhooksPage({ searchParams }: Props) {
  const filters = parseWebhookListFilters(searchParams);

  const loaded = await runWithDb(() =>
    Promise.all([
      prisma.webhookSubscription.findMany({
        where: buildWebhookListWhere(filters),
        orderBy: { createdAt: "desc" },
        include: { client: { select: { companyName: true, slug: true } } },
      }),
      prisma.client.findMany({ orderBy: { companyName: "asc" } }),
    ])
  );

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="onizuka-page-title">Webhook n8n</h1>
          <p className="text-muted-foreground">Automazioni post approvazione.</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const [subscriptions, clients] = loaded.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="onizuka-page-title">Webhook n8n</h1>
        <p className="text-muted-foreground">
          Quando un post viene approvato o segnato come da rivedere, le sottoscrizioni attive ricevono un POST firmato.
          Filtri opzionali via query GET.
        </p>
      </div>

      <Card className="max-w-4xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>URL di destinazione, cliente collegato, tipo evento, stato attivo/inattivo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Testo
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder="URL, cliente…"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 lg:col-span-3">
              <label htmlFor="clientId" className="text-xs font-medium text-muted-foreground">
                Cliente
              </label>
              <Select
                id="clientId"
                name="clientId"
                defaultValue={filters.clientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti (inclusi globali)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label htmlFor="event" className="text-xs font-medium text-muted-foreground">
                Evento
              </label>
              <Select
                id="event"
                name="event"
                defaultValue={filters.event ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                <option value="POST_APPROVED">{eventLabel.POST_APPROVED}</option>
                <option value="POST_STATUS_CHANGED">{eventLabel.POST_STATUS_CHANGED}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label htmlFor="active" className="text-xs font-medium text-muted-foreground">
                Stato
              </label>
              <Select
                id="active"
                name="active"
                defaultValue={filters.active ?? ""}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                <option value="1">Solo attivi</option>
                <option value="0">Solo inattivi</option>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Button type="submit">Applica</Button>
              <Button asChild type="button" variant="outline">
                <Link href="/admin/webhooks">Azzera</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <WebhookDeliveriesPanel />
      <WebhookFailuresPanel />

      <Card>
        <CardHeader>
          <CardTitle>Nuova sottoscrizione</CardTitle>
          <CardDescription>
            L&apos;evento POST_APPROVED viene inviato quando lo stato diventa Approvato; POST_STATUS_CHANGED quando diventa
            Richiede modifiche. Il secret serve a firmare il corpo (HMAC-SHA256). Lascia il cliente vuoto per tutti i
            clienti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookForm clients={clients} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sottoscrizioni</CardTitle>
          <CardDescription>
            Le sottoscrizioni attive ricevono i POST webhook al cambio di stato.
            {filters.q || filters.clientId || filters.event || filters.active
              ? ` ${subscriptions.length} risultat${subscriptions.length === 1 ? "o" : "i"}.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filters.q || filters.clientId || filters.event || filters.active
                ? "Nessun webhook con questi filtri."
                : "Nessun webhook ancora."}
            </p>
          ) : (
            <ul className="space-y-2">
              {subscriptions.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{w.event}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="text-muted-foreground">{w.targetUrl}</span>
                    {w.clientId && (
                      <span className="ml-2 text-muted-foreground">
                        ({w.client?.companyName ?? w.clientId})
                      </span>
                    )}
                    {!w.isActive && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">inattivo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <WebhookTestButton webhookId={w.id} />
                    <WebhookToggleButton id={w.id} isActive={w.isActive} />
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
