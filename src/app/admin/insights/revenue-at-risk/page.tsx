import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { AnalyticsHubTabs } from "@/components/onizuka/analytics-hub-tabs";
import { getRevenueAtRisk } from "@/lib/revenue-at-risk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RevenueAtRiskPage() {
  const session = await requireAdminArea();
  const rows = await getRevenueAtRisk(session.user.id, 25);
  const totalAtRisk = rows.reduce((a, r) => a + r.estimatedAtRiskEur, 0);

  return (
    <div className="space-y-6">
      <AnalyticsHubTabs />
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/insights">← Insights</Link>
      </Button>
      <div>
        <h1 className="onizuka-page-title">Revenue at risk</h1>
        <p className="text-muted-foreground">
          Rinnovi contratti retail imminenti con segnali finance/ticket. Totale stimato a rischio: €{" "}
          {totalAtRisk.toLocaleString("it-IT")}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Clienti a rischio</CardTitle>
          <CardDescription>{rows.length} voci · ordinati per risk score</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun contratto in finestra 120 giorni.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {rows.map((r) => (
                <li key={r.clientId} className="rounded-md border px-3 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <Link href={r.href} className="font-medium text-primary hover:underline">
                      {r.clientName}
                    </Link>
                    <span className="text-xs font-semibold uppercase">{r.riskLevel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Score {r.riskScore} · € {r.estimatedAtRiskEur.toLocaleString("it-IT")} a rischio · {r.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
