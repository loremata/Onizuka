import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Grafico a colonne per una gara TIM: cumulato giorno per giorno (reale fino a
 * oggi, proiezione al ritmo attuale per i giorni restanti), TUTTE le soglie
 * come riferimenti, striscia soglie con la posizione attuale, medie e consiglio.
 * SVG puro, come il donut: niente librerie.
 */

export interface GaraChartData {
  key: string;
  label: string;
  unit: string; // MULTIPLIER_ON_FEE | EUR_PER_PIECE
  qty: number;
  tiers: { minQty: number; value: number }[];
  /** Pezzi (pesati) per giorno del mese, indice 0 = giorno 1. */
  daily: number[];
  dayOfMonth: number;
  daysInMonth: number;
  nextThreshold: number | null;
  missing: number;
  stepValue: number;
  projectedQty: number;
  perDayNeeded: number;
  reachable: boolean;
  /** Gara a moltiplicatore con vendite ma canoni mancanti: compenso non calcolabile. */
  eligFeeZero: boolean;
  isTopFocus: boolean;
  unlocksPrize?: string;
}

const it = (n: number, dec = 0) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: dec });
const eur = (n: number) => "€ " + it(n, 2);

/** "×2,3" per le gare a moltiplicatore, "7,5 €" per quelle a gettone. */
const fmtTier = (unit: string, v: number) => (unit === "MULTIPLIER_ON_FEE" ? "×" + it(v, 1) : it(v, 2) + " €");

export function GaraChart({ d }: { d: GaraChartData }) {
  const pace = d.dayOfMonth > 0 ? d.qty / d.dayOfMonth : 0;

  // --- colonne cumulative: reale fino a oggi, proiettato dopo ---
  const cum: { day: number; value: number; projected: boolean }[] = [];
  let acc = 0;
  for (let day = 1; day <= d.daysInMonth; day++) {
    if (day <= d.dayOfMonth) {
      acc += d.daily[day - 1] ?? 0;
      cum.push({ day, value: acc, projected: false });
    } else {
      cum.push({ day, value: d.qty + pace * (day - d.dayOfMonth), projected: true });
    }
  }

  const soglie = d.tiers.filter((t) => t.minQty > 0);
  const maxSoglia = soglie.length ? soglie[soglie.length - 1].minQty : 0;

  // scala Y del grafico: la parte di gara che è "in gioco" questo mese
  const yMax = Math.max(d.qty, d.projectedQty, d.nextThreshold ?? 0, 1) * 1.18;
  const visibili = soglie.filter((t) => t.minQty <= yMax);

  // --- geometria ---
  const W = 680;
  const H = 190;
  const plotX = 8;
  const plotW = 560;
  const plotTop = 14;
  const plotBottom = 168;
  const plotH = plotBottom - plotTop;
  const colW = (plotW / d.daysInMonth) * 0.72;
  const xOf = (day: number) => plotX + ((day - 1) / d.daysInMonth) * plotW;
  const yOf = (v: number) => plotBottom - (v / yMax) * plotH;

  // --- striscia soglie: tutta la gara su scala reale ---
  const stripMax = Math.max(maxSoglia, d.qty, d.projectedQty) * 1.04 || 1;
  const SX = 10;
  const SW = 600;
  const sx = (v: number) => SX + (v / stripMax) * SW;

  // --- statistiche e consiglio ---
  const daysLeft = d.daysInMonth - d.dayOfMonth;
  const consiglio = buildConsiglio(d, pace, daysLeft);

  return (
    <Card className={d.isTopFocus ? "border-primary/40" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base">
          <span>
            {d.label}
            {d.isTopFocus ? <span className="ml-2 text-xs font-normal text-primary">🎯 priorità del mese</span> : null}
          </span>
          <span className="text-sm font-normal tabular-nums text-muted-foreground">
            {it(d.qty, 1)} {d.qty === 1 ? "pezzo" : "pezzi"}
            {d.nextThreshold != null ? ` · ${it(d.missing, 1)} alla soglia ${d.nextThreshold}` : " · scaglione massimo"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* colonne giornaliere cumulative + soglie in gioco */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Andamento ${d.label}`}>
          {/* soglie visibili nella scala del mese */}
          {visibili.map((t) => (
            <g key={t.minQty}>
              <line
                x1={plotX}
                x2={plotX + plotW}
                y1={yOf(t.minQty)}
                y2={yOf(t.minQty)}
                className="stroke-muted-foreground/40"
                strokeDasharray="5 4"
                strokeWidth={1}
              />
              <text x={plotX + plotW + 6} y={yOf(t.minQty) + 3.5} className="fill-muted-foreground" fontSize={11}>
                {t.minQty} · {fmtTier(d.unit, t.value)}
              </text>
            </g>
          ))}

          {/* separatore "oggi" */}
          {daysLeft > 0 ? (
            <line
              x1={xOf(d.dayOfMonth) + colW}
              x2={xOf(d.dayOfMonth) + colW}
              y1={plotTop}
              y2={plotBottom}
              className="stroke-muted-foreground/30"
              strokeDasharray="2 3"
              strokeWidth={1}
            />
          ) : null}

          {/* colonne: piene = reale, chiare = proiezione al ritmo attuale */}
          {cum.map((c) =>
            c.value > 0 ? (
              <rect
                key={c.day}
                x={xOf(c.day)}
                y={yOf(c.value)}
                width={colW}
                height={Math.max(1, plotBottom - yOf(c.value))}
                rx={1.5}
                className={c.projected ? "fill-primary/25" : "fill-primary"}
              />
            ) : null,
          )}

          {/* asse giorni */}
          <line x1={plotX} x2={plotX + plotW} y1={plotBottom} y2={plotBottom} className="stroke-border" strokeWidth={1} />
          {[1, 5, 10, 15, 20, 25, d.daysInMonth].map((day) => (
            <text key={day} x={xOf(day) + colW / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
              {day}
            </text>
          ))}
        </svg>

        {/* striscia: TUTTE le soglie della gara, con posizione attuale e proiezione */}
        <svg viewBox="0 0 680 46" className="w-full" role="img" aria-label={`Soglie ${d.label}`}>
          <line x1={SX} x2={SX + SW} y1={26} y2={26} className="stroke-muted-foreground/30" strokeWidth={2} />
          {/* tratto già percorso */}
          <line x1={SX} x2={sx(Math.min(d.qty, stripMax))} y1={26} y2={26} className="stroke-primary" strokeWidth={3} />
          {soglie.map((t) => {
            const passed = d.qty >= t.minQty;
            return (
              <g key={t.minQty}>
                <line x1={sx(t.minQty)} x2={sx(t.minQty)} y1={19} y2={33} className={passed ? "stroke-primary" : "stroke-muted-foreground/60"} strokeWidth={2} />
                <text x={sx(t.minQty)} y={12} textAnchor="middle" fontSize={11} className={passed ? "fill-primary font-medium" : "fill-muted-foreground"}>
                  {t.minQty}
                </text>
                <text x={sx(t.minQty)} y={44} textAnchor="middle" fontSize={10} className="fill-muted-foreground">
                  {fmtTier(d.unit, t.value)}
                </text>
              </g>
            );
          })}
          {/* proiezione (cerchio vuoto) e posizione attuale (cerchio pieno) */}
          {daysLeft > 0 && d.projectedQty > d.qty ? (
            <circle cx={sx(Math.min(d.projectedQty, stripMax))} cy={26} r={5} className="fill-background stroke-primary/60" strokeWidth={1.5} strokeDasharray="2 2" />
          ) : null}
          <circle cx={sx(Math.min(d.qty, stripMax))} cy={26} r={5.5} className="fill-primary" />
        </svg>

        {/* medie e numeri chiave */}
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Media" value={`${it(pace, 1)}/gg`} />
          <Stat label="Proiezione" value={daysLeft > 0 ? `~${it(d.projectedQty)}` : it(d.qty, 1)} />
          <Stat
            label="Serve"
            value={d.nextThreshold != null && daysLeft > 0 ? `${it(d.perDayNeeded, 1)}/gg` : "—"}
            warn={d.nextThreshold != null && daysLeft > 0 && d.perDayNeeded > pace}
          />
          <Stat label="Scatto" value={d.stepValue > 0 ? `+${eur(d.stepValue)}` : "—"} />
        </div>

        {/* consiglio */}
        <p className={"text-sm " + (consiglio.tone === "warn" ? "text-amber-700 dark:text-amber-300" : consiglio.tone === "ok" ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
          {consiglio.text}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"font-medium tabular-nums " + (warn ? "text-amber-700 dark:text-amber-300" : "")}>{value}</div>
    </div>
  );
}

/** Il consiglio: una frase sola, che dica cosa fare (o cosa lasciar perdere). */
function buildConsiglio(
  d: GaraChartData,
  pace: number,
  daysLeft: number,
): { text: string; tone: "ok" | "warn" | "muted" } {
  if (d.eligFeeZero) {
    return {
      text: "⚠️ Completa i canoni qui sopra: con i canoni a zero questa gara non può pagare nulla.",
      tone: "warn",
    };
  }
  if (d.nextThreshold == null) {
    return { text: "Scaglione massimo raggiunto: ogni pezzo in più paga al valore pieno. 🎉", tone: "ok" };
  }
  if (daysLeft <= 0) {
    return { text: "Mese chiuso.", tone: "muted" };
  }

  const prize = d.unlocksPrize ? ` E sblocca ${d.unlocksPrize}.` : "";
  const valore = d.stepValue > 0 ? ` Vale +${eur(d.stepValue)} sul mese (rivaluta tutto retroattivamente).` : "";

  if (d.qty === 0) {
    return {
      text: `Ancora ferma: per la soglia di ${d.nextThreshold} servono ${it(d.perDayNeeded, 1)}/gg da qui a fine mese.${valore}${prize}`,
      tone: "muted",
    };
  }
  if (!d.reachable) {
    return {
      text: `La soglia di ${d.nextThreshold} è fuori portata al ritmo attuale (servirebbero ${it(d.perDayNeeded, 1)}/gg contro ${it(pace, 1)}/gg): meglio spingere altrove.`,
      tone: "muted",
    };
  }
  if (d.projectedQty >= d.nextThreshold) {
    const giorniAllaSoglia = pace > 0 ? Math.ceil(d.missing / pace) : daysLeft;
    return {
      text: `Al ritmo attuale (${it(pace, 1)}/gg) superi la soglia di ${d.nextThreshold} fra ~${giorniAllaSoglia} giorni.${valore}${prize}`,
      tone: "ok",
    };
  }
  return {
    text: `Per la soglia di ${d.nextThreshold} servono ${it(d.perDayNeeded, 1)}/gg (oggi vai a ${it(pace, 1)}/gg): serve un cambio di passo.${valore}${prize}`,
    tone: "warn",
  };
}
