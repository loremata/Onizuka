import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadClientHealthRadar } from "@/lib/client-health-radar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClientHealthRadarPage() {
  const session = await requireAdminArea();
  const rows = await loadClientHealthRadar(session.user.id, 25);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/clients">← Clienti</Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Client Health Radar</h1>
        <p className="text-muted-foreground">Clienti a rischio retention (score basso).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Priorità salute cliente</CardTitle>
          <CardDescription>{rows.length} in watch/risk</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.clientId} className="flex flex-wrap items-start justify-between gap-2 rounded-md border px-3 py-2">
                <div>
                  <Link href={r.href} className="font-medium text-primary hover:underline">
                    {r.companyName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    r.riskLevel === "critical"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-amber-500/15 text-amber-700"
                  }`}
                >
                  {r.healthScore} · {r.riskLevel}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
