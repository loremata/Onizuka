import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { loadCrmLeadAnalytics } from "@/lib/crm-lead-analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CrmLeadAnalyticsPage() {
  const session = await requireAdminArea();
  const stats = await loadCrmLeadAnalytics(session.user.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/crm/leads">← Lead</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics lead</h1>
        <p className="text-muted-foreground">Distribuzione per stato e origine, tasso conversione.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Totale lead</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Convertiti</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.converted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Tasso conversione</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.conversionRatePercent}%</p>
            <p className="text-xs text-muted-foreground">{stats.lost} persi</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Per stato</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {stats.byStatus.map((s) => (
                <li key={s.status} className="flex justify-between">
                  <span>{s.label}</span>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Per origine</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {stats.bySource.map((s) => (
                <li key={s.source} className="flex justify-between gap-2">
                  <span className="truncate">{s.source}</span>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
