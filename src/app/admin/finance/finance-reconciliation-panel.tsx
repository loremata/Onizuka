import { loadFinanceReconciliation } from "@/lib/finance-reconciliation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceReconciliationActions } from "./finance-reconciliation-actions";

const severityClass: Record<string, string> = {
  ok: "text-green-600",
  warn: "text-amber-600",
  issue: "text-destructive",
};

export async function FinanceReconciliationPanel({ ownerUserId }: { ownerUserId: string }) {
  const loaded = await loadFinanceReconciliation(ownerUserId);
  if (!loaded.ok) return null;

  const { report } = loaded;

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Riconciliazione</CardTitle>
        <CardDescription>
          Coerenza registro finance, Stripe e date di incasso.
          {report.stripeEnabled ? " Stripe attivo." : " Stripe non configurato."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {report.rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                {row.label}
                {row.hint ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{row.hint}</span>
                ) : null}
              </span>
              <span className={`font-medium tabular-nums ${severityClass[row.severity]}`}>
                {row.count}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {report.healthy
            ? "Nessuna anomalia rilevata sulle regole automatiche."
            : "Correggi le voci segnalate prima della chiusura mensile."}
        </p>
        <FinanceReconciliationActions rows={report.rows} />
      </CardContent>
    </Card>
  );
}
