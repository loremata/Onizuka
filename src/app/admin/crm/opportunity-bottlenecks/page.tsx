import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { getOpportunityPipelineBottlenecks } from "@/lib/opportunity-pipeline-bottleneck";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OpportunityBottlenecksPage() {
  const session = await requireAdminArea();
  const items = await getOpportunityPipelineBottlenecks(session.user.id, 30);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/crm/opportunities">← Opportunità</Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SLA opportunità</h1>
        <p className="text-muted-foreground">
          Opportunità aperte o in pausa oltre SLA o con next action scaduta.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>In stallo</CardTitle>
          <CardDescription>{items.length} elementi</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna opportunità oltre SLA.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {items.map((b) => (
                <li key={b.opportunityId} className="rounded-md border px-3 py-2">
                  <p className="font-medium">
                    {b.title} · {b.clientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.statusLabel} · score {b.priorityScore} · {b.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="mt-3 h-auto px-0">
            <Link href="/admin/crm/pipeline">Apri pipeline</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
