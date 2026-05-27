import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireAdminArea } from "@/lib/admin-session";
import { Button } from "@/components/ui/button";
import { runGlobalSearch } from "@/lib/global-search";
import { DbUnavailableBanner } from "@/components/onizuka/db-unavailable-banner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clientStatusLabel } from "@/lib/crm-client-status";
import { buildClientSearchWhere, parseClientListFilters } from "@/lib/client-list-filters";
import { buildOwnedFlowTaskWhere, parseFlowTaskListFilters } from "@/lib/flow-task-list-filters";
import { buildOwnedLeadWhere, parseLeadListFilters } from "@/lib/lead-list-filters";
import { buildOwnedMemoryWhere, parseMemoryListFilters } from "@/lib/memory-list-filters";
import { buildOwnedOpportunityWhere, parseOpportunityListFilters } from "@/lib/opportunity-list-filters";
import { leadStatusLabel } from "@/lib/crm-lead-status";
import { opportunityStatusLabel } from "@/lib/crm-opportunity";
import { resolveAskIntent } from "@/lib/ask-onizuka";
import { AskAiPanel } from "@/components/onizuka/ask-ai-panel";
import { SchemaSetupBanner } from "@/components/onizuka/schema-setup-banner";
import { ClientLink } from "@/components/onizuka/client-link";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function AdminSearchPage({ searchParams }: Props) {
  const session = await requireAdminArea();

  const clientFilters = parseClientListFilters(searchParams);
  const q = clientFilters.q;
  const ownerId = session.user.id;

  if (!q) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ricerca globale</h1>
          <p className="text-muted-foreground">
            Usa la barra &quot;Chiedi a Onizuka&quot; in alto o aggiungi{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">?q=testo</code> all&apos;URL. Cerca in clienti,
            task Flow (anche cliente/slug), memoria (anche tag esatto), lead, opportunità (titolo, cliente, asset, next
            step), referenti e asset.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Nessuna query</CardTitle>
            <CardDescription>Inserisci almeno un termine per avviare la ricerca.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const leadFilters = parseLeadListFilters(searchParams);
  const flowFilters = parseFlowTaskListFilters(searchParams);
  const memoryFilters = parseMemoryListFilters(searchParams);
  const opportunityFilters = parseOpportunityListFilters(searchParams);

  const search = await runGlobalSearch(ownerId, q, {
    client: clientFilters,
    flow: flowFilters,
    memory: memoryFilters,
    lead: leadFilters,
    opportunity: opportunityFilters,
  });

  if (!search.ok) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ricerca</h1>
          <p className="text-muted-foreground">Risultati per &quot;{q}&quot;</p>
        </div>
        <DbUnavailableBanner />
      </div>
    );
  }

  const { clients, tasks, memories, leads, opportunities, contacts, people, catalogAssets, assetSchemaGap } =
    search.data;

  const total =
    clients.length +
    tasks.length +
    memories.length +
    leads.length +
    opportunities.length +
    contacts.length +
    people.length +
    catalogAssets.length;

  const askIntent = resolveAskIntent(q);

  return (
    <div className="space-y-8">
      <AskAiPanel query={q} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ricerca</h1>
        <p className="text-muted-foreground">
          Risultati per &quot;{q}&quot; — {total} occorrenze in otto elenchi (max 25 ciascuno).
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Dalla barra in alto: comandi brevi (es. <span className="font-mono">pipeline</span>,{" "}
          <span className="font-mono">cerca …</span>, <span className="font-mono">flow</span>). Promemoria sul{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href={`/admin?ask=${encodeURIComponent(q)}`}>
            Command Center
          </Link>
          .
        </p>
      </div>

      {assetSchemaGap ? <SchemaSetupBanner /> : null}

      {askIntent.kind === "navigate" ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suggerimento comando</CardTitle>
            <CardDescription>
              Per &quot;{q}&quot; Onizuka propone il modulo <strong>{askIntent.label}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="secondary">
              <Link href={askIntent.href}>Apri {askIntent.label}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Clienti</CardTitle>
          <CardDescription>{clients.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {clients.length === 0 ? (
            <p className="text-muted-foreground">Nessun cliente corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link className="font-medium text-primary hover:underline" href={`/admin/clients/${c.id}`}>
                    {c.companyName}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {clientStatusLabel[c.status as keyof typeof clientStatusLabel] ?? c.status} · {c.contactEmail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task (Flow)</CardTitle>
          <CardDescription>{tasks.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground">Nessun task corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={
                      t.client
                        ? `/admin/flow?clientId=${encodeURIComponent(t.client.id)}`
                        : "/admin/flow"
                    }
                  >
                    {t.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {t.status}
                    {t.client ? (
                      <>
                        {" "}
                        · <ClientLink clientId={t.client.id} name={t.client.companyName} className="font-normal" />
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memoria</CardTitle>
          <CardDescription>{memories.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {memories.length === 0 ? (
            <p className="text-muted-foreground">Nessuna voce di memoria corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {memories.map((m) => (
                <li key={m.id}>
                  <Link className="font-medium text-primary hover:underline" href={`/admin/memory/${m.id}/edit`}>
                    {m.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {m.scope}
                    {m.client ? (
                      <>
                        {" "}
                        · <ClientLink clientId={m.client.id} name={m.client.companyName} className="font-normal" />
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead</CardTitle>
          <CardDescription>{leads.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {leads.length === 0 ? (
            <p className="text-muted-foreground">Nessun lead corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link className="font-medium text-primary hover:underline" href={`/admin/crm/leads/${l.id}/edit`}>
                    {l.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {leadStatusLabel[l.status as keyof typeof leadStatusLabel] ?? l.status}
                    {l.convertedClient ? (
                      <>
                        {" "}
                        · →{" "}
                        <ClientLink
                          clientId={l.convertedClient.id}
                          name={l.convertedClient.companyName}
                          className="font-normal"
                        />
                      </>
                    ) : (
                      ""
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opportunità</CardTitle>
          <CardDescription>{opportunities.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {opportunities.length === 0 ? (
            <p className="text-muted-foreground">Nessuna opportunità corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {opportunities.map((o) => (
                <li key={o.id}>
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/admin/crm/opportunities/${o.id}/edit`}
                  >
                    {o.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {opportunityStatusLabel[o.status as keyof typeof opportunityStatusLabel] ?? o.status} ·{" "}
                    {o.client ? (
                      <ClientLink clientId={o.client.id} name={o.client.companyName} className="font-normal" />
                    ) : o.lead ? (
                      <Link
                        href={`/admin/crm/leads/${o.lead.id}/edit`}
                        className="text-primary hover:underline"
                      >
                        {o.lead.businessName ?? o.lead.title}
                      </Link>
                    ) : (
                      "Prospect"
                    )}
                    {o.asset ? ` · ${o.asset.name}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Persone (CRM)</CardTitle>
          <CardDescription>{people.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {people.length === 0 ? (
            <p className="text-muted-foreground">Nessuna persona corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Link className="font-medium text-primary hover:underline" href={`/admin/crm/people/${p.id}`}>
                    {p.fullName}
                  </Link>
                  <span className="text-muted-foreground">
                    {p.email ? ` · ${p.email}` : ""}
                    {p.companies.length > 0
                      ? ` · ${p.companies.map((c) => c.companyName).join(", ")}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referenti</CardTitle>
          <CardDescription>{contacts.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {contacts.length === 0 ? (
            <p className="text-muted-foreground">Nessun referente corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    className="font-medium text-primary hover:underline"
                    href={`/admin/clients/${c.client.id}/contacts/${c.id}/edit`}
                  >
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {c.client.companyName}
                    {c.role ? ` · ${c.role}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asset</CardTitle>
          <CardDescription>{catalogAssets.length} risultati</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {catalogAssets.length === 0 ? (
            <p className="text-muted-foreground">Nessun asset corrispondente.</p>
          ) : (
            <ul className="space-y-2">
              {catalogAssets.map((a) => (
                <li key={a.id}>
                  <Link className="font-medium text-primary hover:underline" href={`/admin/clients/${a.client.id}`}>
                    {a.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {" "}
                    — {a.client.companyName} · <span className="font-mono text-xs">{a.slug}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
