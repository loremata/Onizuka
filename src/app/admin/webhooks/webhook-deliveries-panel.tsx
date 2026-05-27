import Link from "next/link";
import { loadPendingWebhookDeliveries } from "@/lib/webhook-delivery-queue";
import { runWithDb } from "@/lib/with-db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhookRetryButton } from "./webhook-retry-button";

export async function WebhookDeliveriesPanel() {
  const loaded = await runWithDb(() => loadPendingWebhookDeliveries(12));
  if (!loaded.ok) return null;

  const rows = loaded.data;
  const dateFmt = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Coda consegne fallite</CardTitle>
        <CardDescription>
          Dead-letter persistente. Retry manuale dopo i 2 tentativi automatici.{" "}
          <Link href="/admin/audit?action=webhook.delivery_failed" className="text-primary hover:underline">
            Audit
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna consegna in coda.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 pb-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-muted-foreground">{dateFmt.format(r.createdAt)}</p>
                  <p className="mt-0.5 truncate font-medium">{r.targetUrl}</p>
                  <p className="text-muted-foreground">
                    HTTP {r.httpStatus}
                    {r.subscription.client?.companyName
                      ? ` · ${r.subscription.client.companyName}`
                      : ""}
                    {r.postItemId ? ` · post ${r.postItemId.slice(0, 8)}…` : ""}
                  </p>
                  {r.errorDetail ? (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive/90">{r.errorDetail}</p>
                  ) : null}
                </div>
                <WebhookRetryButton deliveryId={r.id} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
