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
  const hits = activeId ? await runCrossSellQuery(activeId) : [];
  const activeDef = activeId ? CROSS_SELL_QUERIES.find((d) => d.id === activeId) : null;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Cross-sell e upsell"
        lead="Dieci query predefinite sull'ecosistema Online Station — clienti con servizi mancanti o rinnovi."
      />

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
