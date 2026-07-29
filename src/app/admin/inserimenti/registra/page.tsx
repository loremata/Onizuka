import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { InserimentiNav } from "../module-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonth } from "@/lib/inserimenti/dashboard";
import { lineOptionsForMonth } from "../actions";
import { RegistraForm } from "./registra-form";
import { RecentSales } from "./recent-sales";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function RegistraPage({ searchParams }: { searchParams: { mese?: string } }) {
  const session = await requireFullAdmin();
  // Il mese arriva dall'URL come nelle altre tab del modulo: passando da un mese
  // passato, "Registra" restava inchiodata al mese corrente e mostrava le vendite
  // sbagliate (o nessuna).
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();
  const options = await lineOptionsForMonth(session.user.id, month);
  // piste del mese, appiattite per brand: servono alla tendina della modifica
  const lineChoices = options.flatMap((o) =>
    o.lines.map((l) => ({ brand: o.brand, key: l.key, label: l.label })),
  );

  // La data proposta è oggi solo se stiamo davvero registrando nel mese corrente
  const today = todayISO();
  const defaultDate = today.slice(0, 7) === month ? today : `${month}-01`;

  // TUTTE le vendite del mese, non solo le ultime: da qui si correggono anche
  // le vecchie (canone, offerta) — con 20 righe le prime del mese sparivano.
  const recent = await prisma.storeSale.findMany({
    where: { ownerUserId: session.user.id, month },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const offers = await prisma.storeOffer.findMany({
    where: { ownerUserId: session.user.id, active: true },
    orderBy: [{ brand: "asc" }, { feeEur: "asc" }],
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Registra attivazione"
        lead="Una riga per pezzo. La data resta impostata per registrare in blocco."
      />

      <InserimentiNav />

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
              <RegistraForm
                options={options}
                today={defaultDate}
                offers={offers.map((o) => ({
                  code: o.code,
                  name: o.name,
                  brand: o.brand,
                  feeEur: Number(o.feeEur),
                  lineKey: o.lineKey,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendite del mese</CardTitle>
              <CardDescription>{recent.length} registrate a {month} — ✎ per correggere canone o offerta</CardDescription>
            </CardHeader>
            <CardContent>
              <RecentSales
                sales={recent.map((s) => ({
                  id: s.id,
                  date: s.date.toISOString().slice(0, 10),
                  brand: s.brand,
                  lineKey: s.lineKey,
                  offerCode: s.offerCode,
                  feeEur: s.feeEur == null ? null : Number(s.feeEur),
                  domiciled: s.domiciled,
                  notes: s.notes,
                }))}
                offers={offers.map((o) => ({
                  code: o.code,
                  name: o.name,
                  brand: o.brand,
                  lineKey: o.lineKey,
                  compensoEur: o.compensoEur == null ? null : Number(o.compensoEur),
                }))}
                lines={lineChoices}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
