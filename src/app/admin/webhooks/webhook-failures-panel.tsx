import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { loadRecentWebhookDeliveryFailures } from "@/lib/webhook-failures";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function WebhookFailuresPanel() {
  const loaded = await loadRecentWebhookDeliveryFailures(10);
  if (!loaded.ok) return null;

  const dateFmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Errori di consegna recenti</CardTitle>
        <CardDescription>
          Dal log audit. Ogni invio reale effettua un retry automatico (2 tentativi).{" "}
          <Link href="/admin/audit?action=webhook.delivery_failed" className="text-primary hover:underline">
            Vedi tutti
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loaded.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun errore registrato.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {loaded.rows.map((r) => (
              <li key={r.id} className="border-b border-border/40 pb-2 last:border-0">
                <span className="font-mono text-xs text-muted-foreground">{dateFmt.format(r.at)}</span>
                <p className="mt-0.5">{r.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
