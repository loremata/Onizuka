import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { getLeadPipelineBottlenecks } from "@/lib/lead-pipeline-bottleneck";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadLink } from "@/components/onizuka/client-link";

export default async function PipelineBottlenecksPage() {
  const session = await requireAdminArea();
  const items = await getLeadPipelineBottlenecks(session.user.id, 30);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin">← Command Center</Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Colli di bottiglia lead</h1>
        <p className="text-muted-foreground">Lead oltre SLA per stato pipeline.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lead in stallo</CardTitle>
          <CardDescription>{items.length} elementi</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun lead oltre SLA.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {items.map((b) => (
                <li key={b.leadId} className="rounded-md border px-3 py-2">
                  <LeadLink leadId={b.leadId} name={b.businessName ?? b.title} />
                  <p className="text-xs text-muted-foreground">
                    {b.statusLabel} · score {b.priorityScore} · {b.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="mt-3 h-auto px-0">
            <Link href="/admin/crm/leads">Apri lead</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
