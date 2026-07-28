import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { allFeatureReadiness } from "@/lib/feature-readiness";

/**
 * Quadro d'insieme: cosa fa Onizuka da solo e cosa aspetta un collegamento.
 * Serve a rispondere in dieci secondi alla domanda "cosa promette e cosa
 * mantiene", senza doverlo scoprire pagina per pagina.
 */
export function FeatureReadinessPanel() {
  const features = allFeatureReadiness();
  const notReady = features.filter((f) => !f.ready);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Cosa è collegato</CardTitle>
        <CardDescription>
          {notReady.length === 0
            ? "Tutte le funzioni che dipendono da servizi esterni sono collegate."
            : `${notReady.length} funzioni su ${features.length} aspettano un collegamento. Le pagine relative lo dichiarano.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3 text-sm">
          {features.map((f) => (
            <li key={f.key} className="flex gap-3">
              <span
                className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                  f.ready ? "bg-green-500" : "bg-amber-500"
                }`}
                aria-hidden
              />
              <div>
                <p className="font-medium">
                  {f.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {f.ready ? "collegata" : "non collegata"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {f.ready
                    ? `Attiva: ${f.doesNotHappen}.`
                    : `Non succede: ${f.doesNotHappen}. Serve ${f.missing}.`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
