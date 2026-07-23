import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadDashboard, currentMonth } from "@/lib/inserimenti/dashboard";
import type { BrandBlock } from "@/lib/inserimenti/dashboard";
import type { MonthOutlook } from "@/lib/inserimenti/projection";
import { fwaWeight, sogliaNumber, type Tier } from "@/lib/inserimenti/engine";
import { eur } from "@/lib/inserimenti/format";
import { InserimentiNav } from "../module-nav";
import { MonthNav } from "../month-nav";
import { CanoniMancanti, type SaleSenzaCanone } from "./canoni-mancanti";
import { GaraChart, type GaraChartData } from "./gara-chart";

/**
 * GARA TIM — la pagina della pressione. Qui vive solo quello che ha un target:
 * soglie, cancelli, premi, addon. Tutto il resto del negozio (brand senza
 * obblighi) sta nella tab Negozio.
 */
export default async function GaraTimPage({ searchParams }: { searchParams: { mese?: string } }) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();
  const data = await loadDashboard(session.user.id, month);
  const tim = data.blocks.find((b) => b.brand === "TIM");

  const isCurrent = month === currentMonth();

  // ------- dati extra dal DB: cancelli, addon, vendite senza canone -------
  const plan = await prisma.incentivePlan.findFirst({
    where: { ownerUserId: session.user.id, brand: "TIM", month },
    include: {
      lines: { include: { tiers: { orderBy: { minQty: "asc" } } }, orderBy: { sortOrder: "asc" } },
      prizes: { include: { gates: true } },
      params: true,
    },
  });

  const timSales = plan
    ? await prisma.storeSale.findMany({ where: { ownerUserId: session.user.id, brand: "TIM", month } })
    : [];

  const lineLabel = new Map((plan?.lines ?? []).map((l) => [l.key, l.label]));
  const multiplierKeys = new Set((plan?.lines ?? []).filter((l) => l.unit === "MULTIPLIER_ON_FEE").map((l) => l.key));

  // vendite che per la gara valgono 0 finché il canone manca
  const senzaCanone: SaleSenzaCanone[] = timSales
    .filter((s) => multiplierKeys.has(s.lineKey) && s.feeEur == null && s.subtype !== "FWA_RIC")
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((s) => ({
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      brand: s.brand,
      lineLabel: lineLabel.get(s.lineKey) ?? s.lineKey,
      domiciled: s.domiciled,
      notes: s.notes,
    }));

  // cancelli con progresso (dal risultato del motore, che pesa le FWA ric 0,5)
  const qtyOf = new Map((tim?.result.lines ?? []).map((l) => [l.key, l.qty]));
  const gates = (plan?.prizes ?? []).flatMap((pr) =>
    pr.gates.map((g) => ({
      prize: pr.label,
      lineKey: g.lineKey,
      label: lineLabel.get(g.lineKey) ?? g.lineKey,
      have: qtyOf.get(g.lineKey) ?? 0,
      need: g.minQty,
    })),
  );

  // addon a conteggio (stesse regole del motore, qui solo per la visualizzazione)
  const addonsCfg =
    (plan?.params.find((p) => p.key === "addons")?.valueJson as
      | Array<{ key: string; eur: number; matchLineKey?: string; minFeeEur?: number; provenanceIn?: string[]; minCount: number; group?: string }>
      | undefined) ?? [];
  const addons = addonsCfg.map((a) => {
    const count = timSales.filter(
      (s) =>
        (a.matchLineKey ? s.lineKey === a.matchLineKey : true) &&
        (a.minFeeEur != null ? Number(s.feeEur ?? 0) >= a.minFeeEur : true) &&
        (a.provenanceIn ? a.provenanceIn.includes(s.provenance ?? "") : true),
    ).length;
    return { ...a, count, hit: count >= a.minCount };
  });

  const addonLabel = (a: (typeof addons)[number]) => {
    if (a.minFeeEur != null) return `MNP con canone ≥ ${a.minFeeEur.toLocaleString("it-IT")} €`;
    if (a.provenanceIn) return `MNP da ${a.provenanceIn.join("/")}`;
    return a.key;
  };

  // ------- dati per i grafici a colonne: pezzi (pesati) per giorno e pista -------
  const dayOfMonth = data.daysInMonth - data.daysLeft;
  const dailyByLine = new Map<string, number[]>();
  for (const s of timSales) {
    const w = fwaWeight(s.lineKey, s.subtype);
    const arr = dailyByLine.get(s.lineKey) ?? new Array(data.daysInMonth).fill(0);
    const day = s.date.getUTCDate();
    if (day >= 1 && day <= data.daysInMonth) arr[day - 1] += w;
    dailyByLine.set(s.lineKey, arr);
  }

  // soglie per pista: servono a TimBlock per la numerazione in stile lettera
  // (la regola vive in sogliaNumber del motore, unica fonte)
  const tiersByKey: Record<string, Tier[]> = {};
  for (const l of plan?.lines ?? [])
    tiersByKey[l.key] = l.tiers.map((t) => ({ minQty: t.minQty, value: Number(t.value) }));

  const resultByKey = new Map((tim?.result.lines ?? []).map((l) => [l.key, l]));
  const projByKey = new Map((data.outlook?.lines ?? []).map((p) => [p.key, p]));
  const focusList = tim?.focus ?? [];
  const topFocusKey = focusList[0]?.lineKey ?? null;

  const chartData: GaraChartData[] = (plan?.lines ?? [])
    .filter((l) => l.hasTiers)
    .map((l) => {
      const r = resultByKey.get(l.key);
      const p = projByKey.get(l.key);
      const f = focusList.find((x) => x.lineKey === l.key);
      const qty = r?.qty ?? 0;
      return {
        key: l.key,
        label: l.label,
        unit: l.unit,
        qty,
        tiers: l.tiers.map((t) => ({ minQty: t.minQty, value: Number(t.value) })),
        daily: dailyByLine.get(l.key) ?? new Array(data.daysInMonth).fill(0),
        dayOfMonth,
        daysInMonth: data.daysInMonth,
        nextThreshold: r?.nextThreshold ?? null,
        missing: r?.missing ?? 0,
        stepValue: f?.stepValue ?? r?.stepValue ?? 0,
        projectedQty: p?.projectedQty ?? qty,
        perDayNeeded: p?.perDayNeeded ?? 0,
        reachable: p?.reachable ?? true,
        eligFeeZero: l.unit === "MULTIPLIER_ON_FEE" && qty > 0 && (r?.eligibleFee ?? 0) === 0,
        isTopFocus: l.key === topFocusKey,
        unlocksPrize: f?.unlocksPrize,
      };
    });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Gara TIM"
        lead="L'unico brand con target da raggiungere: soglie, cancelli, premi e addon del mese."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/inserimenti/registra">+ Registra</Link>
          </Button>
        }
      />

      <InserimentiNav />

      <MonthNav basePath="/admin/inserimenti/gara-tim" month={month}>
        {isCurrent && data.daysLeft > 0 ? (
          <span className="text-sm text-muted-foreground">{data.daysLeft} giorni alla fine del mese</span>
        ) : null}
      </MonthNav>

      {!tim || tim.planStatus === "MISSING" ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nessun piano TIM per {month}. Crealo da{" "}
            <Link href="/admin/inserimenti/piano" className="text-primary underline">
              Piani
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Canoni mancanti: la gara li conta 0 finché non li completi */}
          {senzaCanone.length ? (
            <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  ⚠️ {senzaCanone.length} vendite senza canone: per la gara valgono 0 €
                </CardTitle>
                <CardDescription>
                  Le gare TIM moltiplicano la somma dei canoni: completa il canone vero di ognuna e il compenso si
                  ricalcola da solo. (Le FWA ricaricabili non compaiono: non hanno canone.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CanoniMancanti sales={senzaCanone} />
              </CardContent>
            </Card>
          ) : null}

          {/* Cancelli: i semafori della gara */}
          {gates.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cancelli Top Club</CardTitle>
                <CardDescription>
                  Sono in AND: mancarne uno azzera il premio. I pezzi che chiudono un cancello valgono anche punti.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {gates.map((g) => {
                  const pct = Math.min(100, Math.round((g.have / g.need) * 100));
                  const open = g.have >= g.need;
                  const perDay =
                    !open && isCurrent && data.daysLeft > 0 ? (g.need - g.have) / data.daysLeft : null;
                  return (
                    <div key={g.prize + g.lineKey} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">
                          {open ? "🟢" : "🔴"} {g.label}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {g.have}/{g.need}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={"h-full rounded-full " + (open ? "bg-green-600" : "bg-amber-500")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {open
                          ? "cancello aperto"
                          : perDay != null
                            ? `mancano ${(g.need - g.have).toLocaleString("it-IT")} · ritmo ${perDay.toFixed(1)}/gg`
                            : `mancano ${(g.need - g.have).toLocaleString("it-IT")}`}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {/* Vale la pena inseguire i premi? */}
          {(tim.opportunities ?? []).map((o) => (
            <div
              key={o.key}
              className={
                "rounded-lg border px-4 py-3 text-sm " +
                (o.worthChasing
                  ? "border-amber-400/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  : "border-border bg-muted/40 text-muted-foreground")
              }
            >
              <strong>{o.label}</strong> — mancano{" "}
              {o.missingGates
                .map(
                  (g) =>
                    `${g.missing} ${lineLabel.get(g.lineKey) ?? g.lineKey}${
                      data.daysLeft > 0 ? ` (${(g.missing / data.daysLeft).toFixed(1)}/gg)` : ""
                    }`,
                )
                .join(" + ")}{" "}
              = {o.totalMissingPieces} pezzi in {data.daysLeft} giorni.
              {o.worthChasing ? (
                <>
                  {" "}
                  Chiudendoli arriveresti a {o.pointsIfClosed} punti e il premio varrebbe{" "}
                  <strong>{eur(o.prizeIfClosed)}</strong>.
                </>
              ) : (
                <>
                  {" "}
                  Ma anche chiudendoli tutti saresti a <strong>{o.pointsIfClosed} punti</strong> sui {o.minPoints}{" "}
                  minimi: il premio resterebbe <strong>zero</strong>. Non conviene inseguirlo questo mese.
                </>
              )}
            </div>
          ))}

          {/* Focus ora */}
          {data.focusTop ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>🎯 Focus ora</CardDescription>
                <CardTitle className="text-xl">
                  {data.focusTop.label}: mancano {data.focusTop.missing}, +{eur(data.focusTop.stepValue)}
                  {data.focusTop.unlocksPrize ? (
                    <span className="block text-sm font-normal text-primary">
                      include lo sblocco di {data.focusTop.unlocksPrize}
                    </span>
                  ) : (
                    " allo scatto"
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          ) : null}

          {/* Le gare, tabella completa */}
          <TimBlock block={tim} outlook={data.outlook} tiersByKey={tiersByKey} />

          {/* Andamento gara per gara: colonne giornaliere, soglie, medie, consigli */}
          {chartData.length ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Andamento per gara</h2>
                <p className="text-sm text-muted-foreground">
                  Colonne piene = cumulato reale · colonne chiare = proiezione al ritmo attuale · linee tratteggiate =
                  soglie. Sotto, la striscia con tutte le soglie della gara.
                </p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {chartData.map((c) => (
                  <GaraChart key={c.key} d={c} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Addon a conteggio */}
          {addons.length ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Addon MNP</CardTitle>
                <CardDescription>
                  Bonus una tantum sul conteggio del mese (non per pezzo). Iliad/COOP: vale lo scaglione più alto.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {addons.map((a) => {
                  const pct = Math.min(100, Math.round((a.count / a.minCount) * 100));
                  return (
                    <div key={a.key} className="space-y-1.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">
                          {a.hit ? "🟢" : "⚪"} {addonLabel(a)}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {a.count}/{a.minCount}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={"h-full rounded-full " + (a.hit ? "bg-green-600" : "bg-primary/60")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {a.hit ? `+${a.eur} € presi` : `+${a.eur} € al raggiungimento`}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {tim.estimated ? (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              ⚠️ Piano TIM <strong>provvisorio</strong>: i valori possono cambiare quando arriva la lettera.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function TimBlock({
  block,
  outlook,
  tiersByKey,
}: {
  block: BrandBlock;
  outlook: MonthOutlook | null;
  tiersByKey: Record<string, Tier[]>;
}) {
  const r = block.result;
  const gare = r.lines.filter((l) => l.qty > 0 || l.compenso !== 0);
  const projByKey = new Map((outlook?.lines ?? []).map((p) => [p.key, p]));
  /** Numero di soglia in stile lettera; null = sotto la prima soglia. */
  const sogliaNum = (key: string, tierIdx: number): number | null =>
    sogliaNumber(tiersByKey[key] ?? [], tierIdx);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Le gare del mese</CardTitle>
        <CardDescription>{block.planLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Gara</th>
                <th className="py-2 pr-4 text-right">Inseriti</th>
                <th className="py-2 pr-4 text-right">Soglia</th>
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
                    <td className="py-2 pr-4 text-right tabular-nums">{sogliaNum(l.key, l.tierIndex) ?? "—"}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {l.nextThreshold != null ? l.missing : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">
                      {/* "0" ambiguo: su una gara che moltiplica il canone, zero
                          significa "canoni mancanti", non "non mi paga". Sulle
                          piste a gettone zero è un vero zero (sotto soglia). */}
                      {l.unit === "MULTIPLIER_ON_FEE" && l.qty > 0 && l.eligibleFee === 0 ? (
                        <span
                          className="text-amber-600 dark:text-amber-400"
                          title="Compenso non calcolabile: mancano i canoni di queste vendite"
                        >
                          — canoni?
                        </span>
                      ) : (
                        eur(l.compenso)
                      )}
                    </td>
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
                          ~{p.projectedQty} →{" "}
                          {sogliaNum(l.key, p.projectedTierIndex) != null
                            ? `S${sogliaNum(l.key, p.projectedTierIndex)}`
                            : "sotto S1"}
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
                  <td className="py-2 pr-4 font-medium">Extra / Addon</td>
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

export const dynamic = "force-dynamic";
