import Link from "next/link";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initInserimentiStatus } from "./actions";
import { InitButton } from "./init-button";

/**
 * Pagina di go-live del modulo Inserimenti. NON tocca le tabelle del modulo al
 * render (potrebbero non esistere ancora): lo stato passa dall'action, che
 * incapsula il try/catch. Una volta inizializzato, resta come pagina di
 * verifica — e questo file si può rimuovere del tutto.
 */
export default async function InitPage() {
  const status = await initInserimentiStatus();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inserimenti — inizializzazione"
        lead="Prepara il modulo compensi negozio su questo ambiente: tabelle e dati di luglio."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stato attuale</CardTitle>
          <CardDescription>
            {status.tablesReady
              ? `Tabelle presenti · ${status.plans} piani · ${status.offers} offerte · ${status.sales} vendite`
              : "Tabelle del modulo non ancora presenti su questo database."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.tablesReady && status.sales > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-green-700 dark:text-green-400">
                ✓ Modulo inizializzato e popolato. Puoi usare il cruscotto.
              </p>
              <Button asChild>
                <Link href="/admin/inserimenti">Apri il cruscotto →</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>Il pulsante applica, con la connessione dell&apos;app:</p>
                <ul className="list-disc pl-5">
                  <li>le tabelle del modulo (solo CREATE/ALTER, non tocca nulla di esistente);</li>
                  <li>piani di gara, listino offerte e vendite di giugno/luglio;</li>
                  <li>tutti i dati vengono assegnati al TUO utente (quello con cui sei dentro ora).</li>
                </ul>
                <p className="pt-1">
                  È sicuro da ripremere: se si interrompe riparte da dove era, senza duplicare niente.
                </p>
              </div>
              <InitButton />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
