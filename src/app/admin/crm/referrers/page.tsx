import Link from "next/link";
import { requireAdminArea } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReferrersPage() {
  const session = await requireAdminArea();

  const referrers = await prisma.referrer.findMany({
    where: { ownerUserId: session.user.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { leads: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="onizuka-page-title">Segnalatori</h1>
          <p className="text-muted-foreground">Referral engine per lead business.</p>
        </div>
        <Button asChild>
          <Link href="/admin/crm/referrers/new">Nuovo segnalatore</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco</CardTitle>
          <CardDescription>Collega i lead al segnalatore in creazione o modifica lead.</CardDescription>
        </CardHeader>
        <CardContent>
          {referrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun segnalatore ancora.</p>
          ) : (
            <ul className="divide-y text-sm">
              {referrers.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/admin/crm/referrers/${r.id}/edit`}
                      >
                        {r.name}
                      </Link>
                      <Link
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        href={`/admin/crm/leads?referrerId=${r.id}`}
                      >
                        Vedi lead
                      </Link>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.active ? "Attivo" : "Disattivo"} · {r._count.leads} lead
                      {r.email ? ` · ${r.email}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
