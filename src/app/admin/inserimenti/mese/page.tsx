import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { InserimentiNav } from "../module-nav";
import { MonthNav } from "../month-nav";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { currentMonth } from "@/lib/inserimenti/dashboard";
import { InputMensili } from "./input-mensili";

/**
 * Input che NON derivano dalle vendite: arrivano dal consuntivo TIM (M+1) o da
 * conteggi manuali. La pagina si costruisce dai KPI che il piano dichiara come
 * MANUAL — è il vantaggio di aver modellato i punteggi come dati: se il mese
 * prossimo TIM aggiunge o toglie un KPI, questa pagina cambia da sola.
 */
export default async function MesePage({ searchParams }: { searchParams: { mese?: string } }) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();

  const plans = await prisma.incentivePlan.findMany({
    where: { ownerUserId: session.user.id, month },
    include: {
      prizes: {
        include: { scoreKpis: { where: { source: "MANUAL" }, orderBy: { sortOrder: "asc" } }, halvings: true },
      },
    },
  });

  const saved = await prisma.storeMonthlyInput.findMany({
    where: { ownerUserId: session.user.id, month },
  });
  const values: Record<string, string> = {};
  for (const s of saved) values[s.key] = String(Number(s.value)).replace(".", ",");

  // KPI a inserimento manuale, raccolti da tutti i premi di tutti i piani
  const kpis = plans.flatMap((p) =>
    p.prizes.flatMap((pr) =>
      pr.scoreKpis.map((k) => ({ key: k.key, label: k.label, points: Number(k.points), prize: pr.label })),
    ),
  );

  // soglie che dimezzano un premio (es. Volume Up-Selling ≥ 8)
  const halvings = plans.flatMap((p) =>
    p.prizes.flatMap((pr) =>
      pr.halvings.map((h) => ({
        key: h.inputKey,
        label: h.label ?? h.inputKey,
        minValue: Number(h.minValue),
        prize: pr.label,
      })),
    ),
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Input mensili"
        lead="Quello che non si deduce dalle vendite: i KPI del Customer Base e le soglie che arrivano dal consuntivo TIM."
      />

      <InserimentiNav />

      <MonthNav basePath="/admin/inserimenti/mese" month={month} />

      {kpis.length === 0 && halvings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nessun input richiesto per {month}: i piani di questo mese non hanno KPI a inserimento manuale.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="py-4">
              <CardDescription>
                Questi numeri arrivano dal <strong>consuntivo TIM a M+1</strong>, non dal banco. Finché non li inserisci,
                il Customer Base resta a zero — ma vale fino a <strong>1.000 €</strong>, quindi conviene compilarlo
                appena arriva il consuntivo.
              </CardDescription>
            </CardHeader>
          </Card>

          <InputMensili month={month} kpis={kpis} halvings={halvings} initial={values} />
        </>
      )}
    </div>
  );
}
