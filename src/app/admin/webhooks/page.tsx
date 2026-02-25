import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhookForm } from "./webhook-form";
import { WebhookToggleButton } from "./webhook-toggle-button";

export default async function AdminWebhooksPage() {
  const [subscriptions, clients] = await Promise.all([
    prisma.webhookSubscription.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: { select: { companyName: true, slug: true } } },
    }),
    prisma.client.findMany({ orderBy: { companyName: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">n8n webhooks</h1>
        <p className="text-muted-foreground">
          When a post is approved or marked needs revision, active subscriptions receive a signed POST.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add subscription</CardTitle>
          <CardDescription>
            Event POST_APPROVED fires when status becomes Approved; POST_STATUS_CHANGED when it
            becomes Needs revision. Secret is used to sign the body (HMAC-SHA256). Leave client
            empty for all clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookForm clients={clients} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
          <CardDescription>Active subscriptions receive webhook POSTs on status change.</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks yet.</p>
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
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">inactive</span>
                    )}
                  </div>
                  <WebhookToggleButton id={w.id} isActive={w.isActive} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
