import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { getServiceActivationMonthlyReport } from "@/lib/service-activation-monthly";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export default async function ServiceActivationsReportPage({ searchParams }: Props) {
  const session = await requireAdminArea();
  const now = new Date();
  const yRaw = parseInt(String(searchParams.year ?? ""), 10);
  const mRaw = parseInt(String(searchParams.month ?? ""), 10);
  const y = Number.isFinite(yRaw) && yRaw >= 2020 && yRaw <= 2100 ? yRaw : now.getFullYear();
  const m = Number.isFinite(mRaw) && mRaw >= 1 && mRaw <= 12 ? mRaw : now.getMonth() + 1;

  const { monthLabel, cards } = await getServiceActivationMonthlyReport(session.user.id, y, m);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const prevQ = `?year=${prev.getFullYear()}&month=${prev.getMonth() + 1}`;
  const nextQ = `?year=${next.getFullYear()}&month=${next.getMonth() + 1}`;
  const total = cards.reduce((a, c) => a + c.total, 0);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/insights">← Insights</Link>
      </Button>
      <div>
        <h1 className="onizuka-page-title">Attivazioni per servizio</h1>
        <p className="text-muted-foreground">
          Servizi portati in stato attivo nel mese (campo <code className="text-xs">since</code> su scheda cliente).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/reports/service-activations${prevQ}`}>← Mese precedente</Link>
        </Button>
        <span className="font-semibold capitalize">{monthLabel}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/reports/service-activations${nextQ}`}>Mese successivo →</Link>
        </Button>
        <span className="text-sm text-muted-foreground">Totale mese: {total}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.serviceName} className={c.total > 0 ? "border-primary/30" : ""}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{c.category}</CardDescription>
              <CardTitle className="text-base">{c.serviceName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{c.total}</p>
              <p className="text-xs text-muted-foreground">attivazioni nel mese</p>
              {c.brandName ? (
                <p className="mt-2 text-xs text-muted-foreground">Brand: {c.brandName}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
