import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { getRegiaDailySheet, parseRegiaDay } from "@/lib/regia-daily-sheet";
import { computeRegiaKpis } from "@/lib/regia-kpi";
import { RegiaOperativaClient } from "@/components/onizuka/regia-operativa-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RegiaOperativaPage() {
  const session = await requireAdminArea();
  const today = new Date().toISOString().slice(0, 10);
  const day = parseRegiaDay(today);
  const [payload, kpi] = await Promise.all([
    getRegiaDailySheet(session.user.id, day),
    computeRegiaKpis(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">← Command Center</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Regia operativa</h1>
        <p className="text-muted-foreground">
          Agenda giornaliera e KPI commerciali (regia operativa).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Agenda del giorno</CardTitle>
          <CardDescription>Priorità, chiamate e blocchi — salvati per data.</CardDescription>
        </CardHeader>
        <CardContent>
          <RegiaOperativaClient initialDay={today} initialPayload={payload} initialKpi={kpi} />
        </CardContent>
      </Card>
    </div>
  );
}
