import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadDashboard, currentMonth } from "@/lib/inserimenti/dashboard";
import type { BrandBlock, RecapRow } from "@/lib/inserimenti/dashboard";
import type { MonthOutlook } from "@/lib/inserimenti/projection";
import { ChiusuraGiornata } from "./chiusura-giornata";
import { Obiettivo } from "./obiettivo";

const eur = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default async function InserimentiPage({
  searchParams,
}: {
  searchParams: { mese?: string };
}) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();
  const data = await loadDashboard(session.user.id, month);

  // navigazione mese precedente/successivo
  const [yy, mm] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(yy, mm - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const isCurrent = month === currentMonth();
  const delta = data.prevTotal > 0 ? ((data.grandTotal - data.prevTotal) / data.prevTotal) * 100 : 0;

  const tim = data.blocks.find((b) => b.brand === "TIM");
  const linear = data.blocks.filter((b) => b.engineVersion === "linear");
  const provisional = data.blocks.some((b) => b.planStatus === "PROVISIONAL");

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inserimenti — compensi negozio"
        lead="Compensi maturati sulle gare TIM e sui brand a gettone."
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/inserimenti/piano?mese=${month}`}>Piano</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/inserimenti/mese?mese=${month}`}>Input mensili</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/inserimenti/listino">Listino</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/inserimenti/registra">+ Registra</Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/inserimenti?mese=${shift(-1)}`}>← Mese precedente</Link>
        </Button>
        <span className="font-semibold capitalize">{monthLabel}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/inserimenti?mese=${shift(1)}`}>Mese successivo →</Link>
        </Button>
        {!isCurrent ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/inserimenti">Oggi</Link>
          </Button>
        ) : null}
        <span className="ml-auto">
          <Button asChild variant="ghost" size="sm">
            <a href={`/admin/inserimenti/export?mese=${month}`}>Esporta CSV</a>
          </Button>
        </span>
      </div>

      {provisional ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠️ Piano provvisorio: la lettera di gara del mese non è ancora arrivata. I compensi sono una <strong>stima</strong> sulle regole del mese precedente.
        </div>
      ) : null}

      {/* Totale generale + mese su mese */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Totale generale</CardDescription>
            <CardTitle className="text-3xl">{eur(data.grandTotal)}</CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">
              {data.prevTotal > 0 ? (
                <>
                  {data.prevMonth}: {eur(data.prevTotal)}{" "}
                  <span className={delta >= 0 ? "text-green-600" : "text-red-600"}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
                  </span>
                </>
              ) : (
                <>nessun confronto per {data.prevMonth}</>
              )}
            </p>
          </CardHeader>
        </Card>
        {data.focusTop ? (
          <Card className="sm:col-span-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription>🎯 Focus ora</CardDescription>
              <CardTitle className="text-xl">
                {data.focusTop.label}: mancano {data.focusTop.missing}, +{eur(data.focusTop.stepValue)} allo scatto
              </CardTitle>
              {data.outlook && data.outlook.daysLeft > 0 ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  Restano {data.outlook.daysLeft} giorni di {data.outlook.daysInMonth}.
                </p>
              ) : null}
            </CardHeader>
          </Card>
        ) : null}
      </div>

      {/* Obiettivo personale del mese */}
      <Obiettivo
        month={month}
        goal={data.goal}
        total={data.grandTotal}
        daysLeft={data.daysLeft}
        daysInMonth={data.daysInMonth}
      />

      {/* Cancelli a rischio: il premio più grosso del mese */}
      {data.outlook?.prizes.map((p) =>
        p.gateOpen || p.gates.length === 0 ? null : (
          <div
            key={p.key}
            className={
              "rounded-lg border px-4 py-3 text-sm " +
              (p.lost
                ? "border-red-400/40 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "border-amber-400/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200")
            }
          >
            <strong>{p.label}</strong>{" "}
            {p.lost ? "— fuori portata questo mese." : "— cancelli ancora aperti, ma serve ritmo:"}{" "}
            {p.gates
              .filter((g) => g.missing > 0)
              .map(
                (g) =>
                  `${g.lineKey} ${g.current}/${g.needed} (mancano ${g.missing}${
                    g.perDayNeeded > 0 ? `, ${g.perDayNeeded}/giorno` : ""
                  })`,
              )
              .join(" · ")}
            {p.lost ? " I cancelli sono in AND: mancarne uno azzera il premio." : null}
          </div>
        ),
      )}

      {data.blocks.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nessuna vendita registrata per {month}.{" "}
            <Link href="/admin/inserimenti/registra" className="text-primary underline">
              Registra la prima
            </Link>
            .
          </CardContent>
        </Card>
      ) : null}

      {/* Zona TIM: gare, cancelli, premi */}
      {tim ? <TimBlock block={tim} outlook={data.outlook} /> : null}

      {/* Zona brand lineari */}
      {linear.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Altri brand</CardTitle>
            <CardDescription>Senza soglie — ogni pezzo vale uguale.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Brand</th>
                    <th className="py-2 pr-4">Voce</th>
                    <th className="py-2 pr-4 text-right">Pezzi</th>
                    <th className="py-2 pr-4 text-right">Compenso</th>
                  </tr>
                </thead>
                <tbody>
                  {linear.flatMap((b) =>
                    b.result.lines
                      .filter((l) => l.qty > 0)
                      .map((l) => (
                        <tr key={b.brand + l.key} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{b.brand}</td>
                          <td className="py-2 pr-4">{l.label}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{l.qty}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{eur(l.compenso)}</td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Recap per categoria e per brand */}
      {data.byCategory.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <RecapCard title="Per categoria" rows={data.byCategory} />
          <RecapCard title="Per brand" rows={data.byBrand} />
        </div>
      ) : null}

      {/* Chiusura giornata */}
      {data.today ? <ChiusuraGiornata today={data.today} /> : null}
    </div>
  );
}

function RecapCard({ title, rows }: { title: string; rows: RecapRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.compenso));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{r.name}</span>
              <span className="tabular-nums">{eur(r.compenso)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.compenso / max) * 100}%` }} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{r.qty} pezzi</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TimBlock({ block, outlook }: { block: BrandBlock; outlook: MonthOutlook | null }) {
  const r = block.result;
  const gare = r.lines.filter((l) => l.qty > 0 || l.compenso !== 0);
  const projByKey = new Map((outlook?.lines ?? []).map((p) => [p.key, p]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>TIM — gare del mese</CardTitle>
        <CardDescription>{block.planLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Gara</th>
                <th className="py-2 pr-4 text-right">Pezzi</th>
                <th className="py-2 pr-4 text-right">Scaglione</th>
                <th className="py-2 pr-4 text-right">Mancano</th>
                <th className="py-2 pr-4 text-right">Compenso</th>
                <th className="py-2 pr-4 text-right">+€ scatto</th>
                <th className="py-2 pr-4 text-right">A fine mese</th>
              </tr>
            </thead>
            <tbody>
              {gare.map((l) => {
                const p = projByKey.get(l.key);
                return (
                  <tr key={l.key} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{l.label}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{l.qty}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{l.tierIndex + 1}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {l.nextThreshold != null ? l.missing : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{eur(l.compenso)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {l.stepValue > 0 ? "+" + eur(l.stepValue) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-xs">
                      {p ? (
                        <span
                          className={
                            p.willImprove
                              ? "text-green-600"
                              : p.nextThreshold != null && !p.reachable
                                ? "text-muted-foreground line-through"
                                : "text-muted-foreground"
                          }
                          title={
                            p.nextThreshold != null && !p.reachable
                              ? "prossima soglia fuori portata al ritmo attuale"
                              : undefined
                          }
                        >
                          ~{p.projectedQty} → sc. {p.projectedTierIndex + 1}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
              {r.extras !== 0 ? (
                <tr className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">Extra / PxQ</td>
                  <td colSpan={3} />
                  <td className="py-2 pr-4 text-right tabular-nums font-medium">{eur(r.extras)}</td>
                  <td colSpan={2} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Premi a punteggio */}
        {r.prizes.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {r.prizes.map((p) => (
              <div key={p.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.label}</span>
                  <span className="tabular-nums font-semibold">{eur(p.prize)}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Punteggio {p.points}
                  {p.gateOpen ? (
                    " · cancelli aperti"
                  ) : p.worstGate ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      {" "}· manca {p.worstGate.lineKey} (−{p.worstGate.missing})
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end border-t pt-3 text-sm">
          <span className="font-semibold">Totale TIM: {eur(r.total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
