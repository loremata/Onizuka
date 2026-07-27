import Link from "next/link";
import { requireFullAdmin } from "@/lib/admin-session";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentMonth } from "@/lib/inserimenti/dashboard";
import { itNum } from "@/lib/inserimenti/format";
import {
  compareOfficialVsRegistered,
  getOfficialProgressAt,
  listOfficialProgressDates,
  itDate,
  OFFICIAL_LINES,
  type CompareRow,
} from "@/lib/inserimenti/official-progress";
import { InserimentiNav } from "../module-nav";
import { MonthNav } from "../month-nav";
import { AvanzamentoForm, type FormValues } from "./avanzamento-form";

/**
 * AVANZAMENTO GARA — i due numeri affiancati.
 *
 * Quello che ho registrato al banco e quello che TIM dice di riconoscere non
 * coincidono mai del tutto: in mezzo ci sono portabilità ancora in corso,
 * pratiche scartate e pratiche mai caricate. Qui si vede la differenza riga per
 * riga, che è esattamente la lista delle cose da inseguire prima di fine mese.
 */
export default async function AvanzamentoPage({
  searchParams,
}: {
  searchParams: { mese?: string; data?: string };
}) {
  const session = await requireFullAdmin();
  const month = /^\d{4}-\d{2}$/.test(searchParams.mese ?? "") ? searchParams.mese! : currentMonth();

  const [cmp, dates] = await Promise.all([
    compareOfficialVsRegistered({ ownerUserId: session.user.id, brand: "TIM", month }),
    listOfficialProgressDates({ ownerUserId: session.user.id, brand: "TIM", month }),
  ]);

  // quale avanzamento precompilare nel form: quello chiesto nell'URL (storico)
  // oppure l'ultimo caricato
  const wanted = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.data ?? "") ? searchParams.data! : null;
  const editing = wanted && dates.includes(wanted) ? wanted : (cmp.asOfDate ?? null);
  const snapshot = editing
    ? await getOfficialProgressAt({ ownerUserId: session.user.id, brand: "TIM", month, asOfDate: editing })
    : null;

  const initial: FormValues = {};
  for (const l of OFFICIAL_LINES) {
    const v = snapshot?.byLine[l.key];
    initial[l.key] = {
      qty: v ? String(v.qty).replace(".", ",") : "",
      domiciledQty: v?.domiciledQty != null ? String(v.domiciledQty) : "",
      breakdown: v?.breakdown ?? "",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = editing ?? (today.slice(0, 7) === month ? today : `${month}-01`);

  const daInseguire = cmp.rows.filter((r) => r.status === "DA_INSEGUIRE");
  const daRegistrare = cmp.rows.filter((r) => r.status === "DA_REGISTRARE");

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Avanzamento gara"
        lead="Quello che hai registrato tu e quello che TIM riconosce, uno accanto all'altro. La differenza è la lista delle cose da inseguire."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/inserimenti/gara-tim?mese=${month}`}>Vai alla Gara TIM</Link>
          </Button>
        }
      />

      <InserimentiNav />

      <MonthNav basePath="/admin/inserimenti/avanzamento" month={month}>
        {cmp.asOfDate ? (
          <span className="text-sm text-muted-foreground">Ultimo avanzamento TIM: {itDate(cmp.asOfDate)}</span>
        ) : null}
      </MonthNav>

      {/* La frase che spiega perché i numeri sono due */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="py-4">
          <CardDescription className="text-foreground">
            <strong>Registrato</strong> è quello che hai venduto al banco e messo a registro qui.{" "}
            <strong>Riconosciuto</strong> è quello che TIM ti conta e ti paga alla data che comunica. Fra i due ci sono
            le pratiche in lavorazione, gli scarti e quelle non caricate: la differenza è denaro in ballo, non un errore
            di conteggio.
          </CardDescription>
        </CardHeader>
      </Card>

      {!cmp.hasOfficial ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Per {month} non hai ancora inserito nessun avanzamento TIM: qui sotto si vede solo quello che hai
              registrato tu.
            </p>
            <p className="text-sm text-muted-foreground">
              Quando TIM manda l&apos;avanzamento (la tabella con i numeri riconosciuti alla data), trascrivilo nel
              modulo in fondo alla pagina: da quel momento il confronto compare da solo.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Sintesi: quanto c'è da inseguire, quanto da registrare */}
      {cmp.hasOfficial && (cmp.totalToChase > 0 || cmp.totalToRecord > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardDescription>Da inseguire</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{itNum(cmp.totalToChase, 2)}</CardTitle>
              <p className="pt-1 text-xs text-muted-foreground">
                {daInseguire.length
                  ? `attivazioni registrate che TIM non conta ancora — ${daInseguire.map((r) => r.label).join(", ")}`
                  : "niente in sospeso"}
              </p>
            </CardHeader>
          </Card>
          <Card className="border-purple-400/40 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader className="pb-3">
              <CardDescription>Da registrare</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{itNum(cmp.totalToRecord, 2)}</CardTitle>
              <p className="pt-1 text-xs text-muted-foreground">
                {daRegistrare.length
                  ? `pezzi che TIM conta e qui non risultano — ${daRegistrare.map((r) => r.label).join(", ")}`
                  : "niente da recuperare"}
              </p>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* La tabella del confronto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrato da me vs Riconosciuto da TIM</CardTitle>
          <CardDescription>
            {cmp.hasOfficial
              ? `Avanzamento TIM al ${itDate(cmp.asOfDate!)} · vendite registrate in ${month}.`
              : `Solo le vendite registrate in ${month}: l'avanzamento TIM non è ancora stato inserito.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Pista</th>
                  <th className="py-2 pr-4 text-right">Registrato</th>
                  <th className="py-2 pr-4 text-right">
                    Riconosciuto {cmp.asOfDate ? <span className="font-normal">al {itDate(cmp.asOfDate)}</span> : null}
                  </th>
                  <th className="py-2 pr-4 text-right">Delta</th>
                  <th className="py-2">Cosa vuol dire</th>
                </tr>
              </thead>
              <tbody>
                {cmp.rows.map((r) => (
                  <RigaConfronto key={r.lineKey} r={r} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-3 text-xs text-muted-foreground">
            Su alcune piste i numeri non sono confrontabili uno a uno: nella gara una FWA ricaricabile pesa 0,5 e un
            bundle multi-OTT (TIMVision L, Dazn completo, MyClub) pesa più di un pezzo, mentre al banco resta una riga
            sola. Il confronto con TIM usa il <strong>peso di gara</strong>, che trovi sotto l&apos;etichetta della pista.
          </p>
        </CardContent>
      </Card>

      {/* Storico avanzamenti del mese */}
      {dates.length > 1 || (dates.length === 1 && editing !== dates[0]) ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storico del mese</CardTitle>
            <CardDescription>Gli avanzamenti già trascritti. Aprine uno per rileggerlo o correggerlo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <Link
                key={d}
                href={`/admin/inserimenti/avanzamento?mese=${month}&data=${d}`}
                className={
                  "rounded-full border px-3 py-1.5 text-sm tabular-nums transition-colors " +
                  (d === editing
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:border-primary hover:bg-muted")
                }
              >
                {itDate(d)}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* key sulla data: aprendo un altro avanzamento dallo storico il modulo
          si ricarica coi numeri di quella data invece di restare com'era */}
      <AvanzamentoForm
        key={`${month}:${editing ?? "nuovo"}`}
        month={month}
        defaultDate={defaultDate}
        lines={OFFICIAL_LINES.map((l) => ({ key: l.key, label: l.label, domiciled: l.domiciled }))}
        initial={initial}
        loadedFrom={editing}
      />
    </div>
  );
}

/** Una riga del confronto, col colore che dice subito cosa farne. */
function RigaConfronto({ r }: { r: CompareRow }) {
  const tone =
    r.status === "DA_INSEGUIRE"
      ? "text-amber-700 dark:text-amber-300"
      : r.status === "DA_REGISTRARE"
        ? "text-purple-700 dark:text-purple-300"
        : r.status === "OK"
          ? "text-green-700 dark:text-green-400"
          : "text-muted-foreground";

  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-2 pr-4 font-medium">
        {r.label}
        {r.registeredFwaRic != null && r.registeredFwaRic > 0 ? (
          <span className="block text-xs font-normal text-muted-foreground">
            di cui {r.registeredFwaRic} FWA ric · peso gara {itNum(r.registeredWeighted ?? 0, 2)}
          </span>
        ) : r.registeredWeighted != null && r.registered != null ? (
          // Contenuti & co.: i bundle multi-OTT valgono più di un pezzo, quindi
          // il numero confrontato con TIM non è quello delle righe registrate.
          <span className="block text-xs font-normal text-muted-foreground">
            {itNum(r.registered, 2)} al banco · peso gara {itNum(r.registeredWeighted, 2)}
          </span>
        ) : null}
        {r.breakdown ? (
          <span className="block text-xs font-normal text-muted-foreground">TIM dichiara: {r.breakdown}</span>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {r.registered == null ? <span className="text-muted-foreground">—</span> : itNum(r.registered, 2)}
        {r.registeredDomiciled > 0 ? (
          <span className="block text-xs text-muted-foreground">{r.registeredDomiciled} domic.</span>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {r.official == null ? <span className="text-muted-foreground">—</span> : itNum(r.official, 2)}
        {r.officialDomiciled != null ? (
          <span className="block text-xs text-muted-foreground">{r.officialDomiciled} domic.</span>
        ) : null}
      </td>
      <td className="py-2 pr-4 text-right">
        {r.delta == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <DeltaBadge delta={r.delta} status={r.status} />
        )}
      </td>
      <td className={"py-2 text-xs " + tone}>{r.hint}</td>
    </tr>
  );
}

function DeltaBadge({ delta, status }: { delta: number; status: CompareRow["status"] }) {
  const testo = (delta > 0 ? "+" : delta < 0 ? "−" : "") + itNum(Math.abs(delta), 2);

  if (status === "DA_INSEGUIRE") {
    return (
      <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-700 tabular-nums dark:text-amber-300">
        {testo} da inseguire
      </Badge>
    );
  }
  if (status === "DA_REGISTRARE") {
    return (
      <Badge className="border-purple-400/40 bg-purple-500/15 text-purple-700 tabular-nums dark:text-purple-300">
        {testo} da registrare
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="tabular-nums">
      quadra
    </Badge>
  );
}

export const dynamic = "force-dynamic";
