import { dateTimeFormatIt } from "@/lib/datetime-it";
import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadUpcomingRetailRenewals } from "@/lib/retail-contract-renewals";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RetailRenewalsPage() {
  const session = await requireAdminArea();
  const rows = await loadUpcomingRetailRenewals(session.user.id, 90);
  const fmt = dateTimeFormatIt({ dateStyle: "medium" });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/insights/forecast">← Forecast</Link>
      </Button>
      <div>
        <h1 className="onizuka-page-title">Rinnovi contratti retail</h1>
        <p className="text-muted-foreground">Contratti attivi con scadenza nei prossimi 90 giorni.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Scadenze</CardTitle>
          <CardDescription>{rows.length} contratti</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun rinnovo imminente.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 border-b border-border/50 py-2">
                  <div>
                    <Link href={r.href} className="font-medium text-primary hover:underline">
                      {r.clientName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {r.label} · € {r.monthlyEur.toLocaleString("it-IT")}/mese
                    </p>
                  </div>
                  <span className="text-xs tabular-nums">
                    {fmt.format(r.renewalDate)} ({r.daysUntil}g)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
