import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import {
  CROSS_SELL_QUERIES,
  runCrossSellQuery,
  type CrossSellQueryId,
} from "@/lib/cross-sell-queries";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPipelineForAllClients } from "@/lib/customer-value";
import { CUSTOMER_BAND_LABEL } from "@/lib/client-customer-scoring";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
};

function parseQueryId(raw: string | string[] | undefined): CrossSellQueryId | null {
  const q = typeof raw === "string" ? raw : raw?.[0];
  if (!q) return null;
  return CROSS_SELL_QUERIES.some((d) => d.id === q) ? (q as CrossSellQueryId) : null;
}

export default async function CrossSellPage({ searchParams }: Props) {
  await requireAdminArea();
  const activeId = parseQueryId(searchParams.q);
  const [hits, topClients] = await Promise.all([
    activeId ? runCrossSellQuery(activeId) : Promise.resolve([]),
    getPipelineForAllClients(15),
  ]);
  const activeDef = activeId ? CROSS_SELL_QUERIES.find((d) => d.id === activeId) : null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Cross-sell e upsell"
        lead="Prossime mosse consigliate per cliente (pipeline up/cross-sell con probabilità, valore atteso e CLV) più le dieci query predefinite sull'ecosistema Online Station."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prossime mosse consigliate</CardTitle>
          <CardDescription>
            Top {topClients.length} clienti per indice priorità (score × pipeline attesa). Dettaglio completo nella scheda cliente, tab Commerciale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun cliente attivo con pipeline calcolabile: aggiorna servizi attivi e contratti retail sulle schede cliente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b text-left align-bottom">
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Score</th>
                    <th className="pb-2 font-medium">Top opportunità</th>
                    <th className="pb-2 pr-3 text-right font-medium">Pipeline</th>
                    <th className="pb-2 pr-3 text-right font-medium">CLV potenziale</th>
                    <th className="pb-2 text-right font-medium">Priorità</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((c) => {
                    const top = c.opportunities[0];
                    return (
                      <tr key={c.clientId} className="border-b align-top last:border-0">
                        <td className="py-3 pr-3">
                          <Link href={`/admin/clients/${c.clientId}`} className="font-medium text-primary hover:underline">
                            {c.companyName}
                          </Link>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="tabular-nums">{c.score.score}</span>{" "}
                          <Badge variant="secondary">{CUSTOMER_BAND_LABEL[c.score.band]}</Badge>
                        </td>
                        <td className="py-3 pr-3">
                          {top ? (
                            <>
                              <span className="font-medium">{top.name}</span>
                              <p className="text-xs text-muted-foreground">
                                {Math.round(top.probability * 100)}% · € {top.expectedValueEur.toLocaleString("it-IT")} attesi
                              </p>
                              <Button asChild size="sm" variant="outline" className="mt-1 h-7 text-xs">
                                <Link
                                  href={`/admin/crm/opportunities/new?clientId=${c.clientId}&service=${encodeURIComponent(top.serviceSlug)}`}
                                >
                                  Proponi
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          € {c.pipelineTotalEur.toLocaleString("it-IT")}
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums">
                          € {c.clv.potentialEur.toLocaleString("it-IT")}
                        </td>
                        <td className="py-3 text-right font-medium tabular-nums">{c.priorityIndex}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Query salvate</CardTitle>
            <CardDescription>Seleziona un pattern per elencare i clienti target.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {CROSS_SELL_QUERIES.map((q) => (
              <Button
                key={q.id}
                asChild
                variant={activeId === q.id ? "default" : "outline"}
                size="sm"
                className="h-auto w-full justify-start whitespace-normal py-2 text-left"
              >
                <Link href={`/admin/crm/cross-sell?q=${q.id}`}>{q.title}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risultati</CardTitle>
            <CardDescription>
              {activeDef ? activeDef.objective : "Scegli una query a sinistra."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!activeId ? (
              <p className="text-sm text-muted-foreground">Nessuna query attiva.</p>
            ) : hits.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun cliente corrisponde (verifica servizi attivi sulle schede cliente).
              </p>
            ) : (
              <ul className="space-y-2">
                {hits.map((h) => (
                  <li key={h.clientId} className="rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm">
                    <Link href={`/admin/clients/${h.clientId}`} className="font-medium text-primary hover:underline">
                      {h.companyName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{h.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link href={`/admin/clients/${h.clientId}`}>Scheda</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link href={`/admin/reach?clientId=${h.clientId}`}>Reach</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
