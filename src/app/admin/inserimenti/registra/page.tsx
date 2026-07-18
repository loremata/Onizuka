import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentMonth } from "@/lib/inserimenti/dashboard";
import { lineOptionsForMonth } from "../actions";
import { RegistraForm } from "./registra-form";
import { RecentSales } from "./recent-sales";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function RegistraPage() {
  const session = await requireFullAdmin();
  const month = currentMonth();
  const options = await lineOptionsForMonth(session.user.id, month);

  const recent = await prisma.storeSale.findMany({
    where: { ownerUserId: session.user.id, month },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Registra attivazione"
        lead="Una riga per pezzo. La data resta impostata per registrare in blocco."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/inserimenti">← Cruscotto</Link>
          </Button>
        }
      />

      {options.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessun piano per {month}. Esegui il seed dei piani prima di registrare.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Nuova vendita</CardTitle>
              <CardDescription>Il canone serve solo alle gare TIM (moltiplicano la somma dei canoni).</CardDescription>
            </CardHeader>
            <CardContent>
              <RegistraForm options={options} today={todayISO()} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ultime del mese</CardTitle>
              <CardDescription>{recent.length} registrate a {month}</CardDescription>
            </CardHeader>
            <CardContent>
              <RecentSales
                sales={recent.map((s) => ({
                  id: s.id,
                  date: s.date.toISOString().slice(0, 10),
                  brand: s.brand,
                  lineKey: s.lineKey,
                  feeEur: s.feeEur == null ? null : Number(s.feeEur),
                  domiciled: s.domiciled,
                  notes: s.notes,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
