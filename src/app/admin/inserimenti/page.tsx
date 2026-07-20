import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadDashboard, currentMonth } from "@/lib/inserimenti/dashboard";
import type { BrandBlock } from "@/lib/inserimenti/dashboard";
import type { MonthOutlook } from "@/lib/inserimenti/projection";
import { loadBreakdown, type Slice } from "@/lib/inserimenti/breakdown";
import { DonutChart } from "@/components/onizuka/donut-chart";
import { ChiusuraGiornata } from "./chiusura-giornata";
import { Obiettivo } from "./obiettivo";

const eur = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default async function InserimentiPage({
  searchParams,
}: {
  searchParams: { mese?: string; brand?: string; cat?: string };
}) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();
  const data = await loadDashboard(session.user.id, month);

  // recap interattivo: filtri brand/categoria e spaccato, sulla stessa pagina
  const fBrand = searchParams.brand || null;
  const fCat = searchParams.cat || null;
  const bd = await loadBreakdown(session.user.id, month, fBrand, fCat);

  /** Link che conserva mese e altri filtri. */
  const flt = (patch: { brand?: string | null; cat?: string | null }) => {
    const p = new URLSearchParams();
    if (month !== currentMonth()) p.set("mese", month);
    const b = patch.brand === undefined ? fBrand : patch.brand;
    const c = patch.cat === undefined ? fCat : patch.cat;
    if (b) p.set("brand", b);
    if (c) p.set("cat", c);
    const q = p.toString();
    return "/admin/inserimenti" + (q ? `?${q}` : "") + "#recap";
  };

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

  // --- KPI a colpo d'occhio ---
  const pezziTot = data.byBrand.reduce((a, b) => a + b.qty, 0);
  const giorniFatti = data.daysInMonth - data.daysLeft;
  const ritmo = giorniFatti > 0 ? pezziTot / giorniFatti : 0;
  const mediaPezzo = pezziTot > 0 ? data.grandTotal / pezziTot : 0;
  const proiezione = isCurrent && giorniFatti > 0 ? (data.grandTotal / giorniFatti) * data.daysInMonth : data.grandTotal;
  const senzaCanone = bd.totale.senzaCanone;

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
          ⚠️ Compensi <strong>stimati</strong> per {data.blocks.filter((b) => b.estimated).map((b) => b.brand).join(", ")}:
          i valori non sono confermati da una lettera di incentivazione. Le cifre marcate con{" "}
          <span className="font-mono">~</span> possono cambiare.
        </div>
      ) : null}

      {/* Premi a cancelli: vale davvero inseguirli? */}
      {data.blocks
        .flatMap((b) => b.opportunities ?? [])
        .map((o) => (
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
                  `${g.missing} ${g.lineKey}${
                    data.daysLeft > 0 ? ` (${(g.missing / data.daysLeft).toFixed(1)}/gg)` : ""
                  }`,
              )
              .join(" + ")}{" "}
            = {o.totalMissingPieces} pezzi in {data.daysLeft} giorni. I cancelli sono in AND: mancarne uno azzera il
            premio.
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

      {/* KPI a colpo d'occhio — totali */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Compensi del mese</CardDescription>
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Attivazioni</CardDescription>
            <CardTitle className="text-3xl">{pezziTot}</CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">
              {ritmo > 0 ? `${ritmo.toFixed(1)}/giorno` : "—"}
              {senzaCanone > 0 ? ` · ${senzaCanone} senza canone` : ""}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Media per pezzo</CardDescription>
            <CardTitle className="text-3xl">{eur(mediaPezzo)}</CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">compenso medio</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{isCurrent ? "Proiezione fine mese" : "Totale mese"}</CardDescription>
            <CardTitle className="text-3xl">{eur(proiezione)}</CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">
              {isCurrent && data.daysLeft > 0 ? `al ritmo attuale · ${data.daysLeft} gg rimasti` : "mese chiuso"}
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* KPI per brand */}
      {data.byBrand.length ? (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {data.byBrand.map((b) => {
            const quota = data.grandTotal > 0 ? Math.round((b.compenso / data.grandTotal) * 100) : 0;
            const est = data.blocks.find((x) => x.brand === b.name)?.estimated;
            return (
              <Card key={b.name}>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center justify-between">
                    <span>{b.name}</span>
                    {est ? <span className="text-amber-600" title="valori stimati">~</span> : null}
                  </CardDescription>
                  <CardTitle className="text-xl">{eur(b.compenso)}</CardTitle>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${quota}%` }} />
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">
                    {b.qty} pezzi · {quota}% del totale
                  </p>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      ) : null}

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
            {data.outlook && data.outlook.daysLeft > 0 ? (
              <p className="pt-1 text-xs text-muted-foreground">
                Restano {data.outlook.daysLeft} giorni di {data.outlook.daysInMonth}.
              </p>
            ) : null}
          </CardHeader>
        </Card>
      ) : null}

      {/* Obiettivo personale del mese */}
      <Obiettivo
        month={month}
        goal={data.goal}
        total={data.grandTotal}
        daysLeft={data.daysLeft}
        daysInMonth={data.daysInMonth}
      />


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

      {/* Recap interattivo: filtri, torte, spaccato */}
      {bd.brands.length ? (
        <div id="recap" className="space-y-4 scroll-mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Recap</h2>
            {fBrand || fCat ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={flt({ brand: null, cat: null })}>Azzera filtri ✕</Link>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroChip href={flt({ brand: null, cat: null })} active={!fBrand}>
              Tutti i brand
            </FiltroChip>
            {bd.brands.map((b) => (
              <FiltroChip key={b.name} href={flt({ brand: b.name, cat: null })} active={fBrand === b.name}>
                {b.name} <span className="opacity-60">{b.qty}</span>
              </FiltroChip>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <FiltroChip href={flt({ cat: null })} active={!fCat}>
              Tutte le categorie
            </FiltroChip>
            {bd.categories.map((c) => (
              <FiltroChip key={c.name} href={flt({ cat: c.name })} active={fCat === c.name}>
                {c.name} <span className="opacity-60">{c.qty}</span>
              </FiltroChip>
            ))}
          </div>

          {fBrand || fCat ? (
            <Card>
              <CardHeader className="py-4">
                <CardDescription>
                  {fBrand ?? "Tutti i brand"}
                  {fCat ? ` · ${fCat}` : ""}
                </CardDescription>
                <CardTitle className="text-xl">
                  {bd.totale.qty} pezzi · {eur(bd.totale.compenso)}
                </CardTitle>
                {bd.totale.senzaCanone > 0 ? (
                  <p className="pt-1 text-xs text-amber-700 dark:text-amber-300">
                    ⚠ {bd.totale.senzaCanone} vendite senza canone: il totale reale è più alto.
                  </p>
                ) : null}
              </CardHeader>
            </Card>
          ) : null}

          {/* senza categoria aperta: le due torte d'insieme */}
          {!fCat ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Per brand</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    slices={bd.brands.map((b) => ({ name: b.name, value: b.qty, hint: eur(b.compenso) }))}
                    centerLabel={String(bd.brands.reduce((a, b) => a + b.qty, 0))}
                    centerSub="pezzi"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Per categoria</CardTitle>
                  <CardDescription>Clicca una categoria per aprire lo spaccato.</CardDescription>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    slices={bd.categories.map((c) => ({ name: c.name, value: c.qty, hint: eur(c.compenso) }))}
                    centerLabel={String(bd.categories.reduce((a, c) => a + c.qty, 0))}
                    centerSub="pezzi"
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* categoria aperta: di cosa è fatta */}
          {bd.detail ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <SpaccatoCard
                title="Per tipo di operazione"
                description="Le piste che compongono questa categoria."
                slices={bd.detail.byLine}
              />
              {bd.detail.byPagamento.length > 1 ? (
                <SpaccatoCard
                  title="Ricaricabili vs domiciliate"
                  description="La domiciliazione cambia il compenso: +1,2 sulle MNP, +1,5 sulle AL, e sul fisso da 1,7 a 5,0."
                  slices={bd.detail.byPagamento}
                />
              ) : null}
              <SpaccatoCard
                title="Per offerta"
                description="Quali offerte hai venduto davvero."
                slices={bd.detail.byOffer}
              />
              {bd.detail.byProvenance.length ? (
                <SpaccatoCard
                  title="Provenienza (MNP)"
                  description="Da quale operatore arrivano le portabilità."
                  slices={bd.detail.byProvenance}
                />
              ) : null}
              {bd.detail.byBrand.length > 1 ? (
                <SpaccatoCard title="Per brand" description="" slices={bd.detail.byBrand} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Chiusura giornata */}
      {data.today ? <ChiusuraGiornata today={data.today} /> : null}
    </div>
  );
}

function FiltroChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        "rounded-full border px-3 py-1.5 text-sm transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:border-primary hover:bg-muted")
      }
    >
      {children}
    </Link>
  );
}

function SpaccatoCard({ title, description, slices }: { title: string; description: string; slices: Slice[] }) {
  const tot = slices.reduce((a, s) => a + s.compenso, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <DonutChart
          slices={slices.map((s) => ({
            name: s.name,
            value: s.qty,
            hint: s.compenso > 0 ? eur(s.compenso) : "compenso non calcolabile",
          }))}
          centerLabel={String(slices.reduce((a, s) => a + s.qty, 0))}
          centerSub={tot > 0 ? eur(tot) : "pezzi"}
        />
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
