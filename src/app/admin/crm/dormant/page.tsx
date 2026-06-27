import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { getDormantClients } from "@/lib/dormant-reactivation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DormantReactivationPage() {
  const session = await requireAdminArea();
  const items = await getDormantClients(session.user.id, 30);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin">← Command Center</Link>
      </Button>
      <div>
        <h1 className="onizuka-page-title">Riattivazione dormienti</h1>
        <p className="text-muted-foreground">Clienti DORMANT / TO_REACTIVATE con score priorità.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Radar dormienti</CardTitle>
          <CardDescription>{items.length} clienti</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun cliente prioritario.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {items.map((d) => (
                <li key={d.clientId} className="rounded-md border px-3 py-2">
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
        </CardContent>
      </Card>
    </div>
  );
}
