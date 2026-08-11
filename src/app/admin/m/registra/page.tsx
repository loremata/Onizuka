import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { currentMonth } from "@/lib/inserimenti/dashboard";
import { lineOptionsForMonth } from "../../inserimenti/actions";
import { RegistraForm } from "../../inserimenti/registra/registra-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Al banco si registra il mese corrente: niente selettore del mese, che sul
 * telefono e' solo un modo per sbagliare. Le correzioni sui mesi passati
 * restano sul desktop, in /admin/inserimenti/registra.
 */
export default async function MobileRegistraPage() {
  const session = await requireFullAdmin();
  const month = currentMonth();
  const today = todayISO();

  const [options, offers, todayCount, monthCount] = await Promise.all([
    lineOptionsForMonth(session.user.id, month),
    prisma.storeOffer.findMany({
      where: { ownerUserId: session.user.id, active: true },
      orderBy: [{ brand: "asc" }, { feeEur: "asc" }],
    }),
    prisma.storeSale.count({
      where: { ownerUserId: session.user.id, month, date: new Date(today) },
    }),
    prisma.storeSale.count({ where: { ownerUserId: session.user.id, month } }),
  ]);

  return (
    <div className="space-y-4">
      {/* L'intestazione resta anche senza piano: sapere dove si e' vale sempre. */}
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Registra</h1>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{todayCount}</span> oggi ·{" "}
          <span className="tabular-nums">{monthCount}</span> nel mese
        </p>
      </div>

      <Card>
        <CardContent className={options.length === 0 ? "py-8" : "pt-6"}>
          {options.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nessun piano per {month}. Va creato dal desktop prima di registrare.
            </p>
          ) : (
            <RegistraForm
              options={options}
              today={today}
              offers={offers.map((o) => ({
                code: o.code,
                name: o.name,
                brand: o.brand,
                feeEur: Number(o.feeEur),
                lineKey: o.lineKey,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
