import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LeadBottleneckItem } from "@/lib/lead-pipeline-bottleneck";
import type { DormantClientItem } from "@/lib/dormant-reactivation";
import { LeadLink } from "@/components/onizuka/client-link";

type Props = {
  bottlenecks: LeadBottleneckItem[];
  dormant: DormantClientItem[];
};

export function CrmOpsPanel({ bottlenecks, dormant }: Props) {
  if (bottlenecks.length === 0 && dormant.length === 0) return null;

  return (
    <Card className="border-amber-500/20">
      <CardHeader>
        <CardTitle>CRM operativo</CardTitle>
        <CardDescription>Colli di bottiglia lead e clienti da riattivare.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2 text-sm">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Lead in stallo</h3>
          {bottlenecks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun lead oltre SLA.</p>
          ) : (
            <ul className="space-y-2">
              {bottlenecks.map((b) => (
                <li key={b.leadId}>
                  <LeadLink leadId={b.leadId} name={b.businessName ?? b.title} />
                  <p className="text-xs text-muted-foreground">{b.reason}</p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="mt-2 h-auto px-0 text-xs">
            <Link href="/admin/crm/bottlenecks">Dettaglio bottleneck</Link>
          </Button>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Clienti dormienti</h3>
          {dormant.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun cliente prioritario.</p>
          ) : (
            <ul className="space-y-2">
              {dormant.map((d) => (
                <li key={d.clientId}>
                  <Link href={`/admin/clients/${d.clientId}`} className="font-medium text-primary hover:underline">
                    {d.companyName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Score {d.potentialScore} · {d.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="link" className="mt-2 h-auto px-0 text-xs">
            <Link href="/admin/crm/dormant">Dettaglio dormienti</Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/regia-operativa">Regia operativa</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/intelligence">Intelligence</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/analytics">Analytics lead</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/health-radar">Health radar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/insights/revenue-at-risk">Revenue at risk</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/crm/contacts">Contatti</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/walkin">Walk-in pubblico</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
