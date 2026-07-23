/**
 * Grafico ad anello in SVG puro: nessuna libreria, nessun JS a runtime.
 * Sta in un server component e si stampa bene.
 */

export interface DonutSlice {
  name: string;
  value: number;
  /** Etichetta secondaria sotto il valore (es. il compenso). */
  hint?: string;
}

// palette leggibile in chiaro e scuro, distinguibile anche in scala di grigi
const COLORS = [
  "hsl(221 83% 53%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(0 72% 51%)",
  "hsl(199 89% 48%)",
  "hsl(84 60% 45%)",
  "hsl(25 80% 55%)",
];

export function DonutChart({
  slices,
  size = 150,
  thickness = 26,
  centerLabel,
  centerSub,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return <p className="text-sm text-muted-foreground">Nessun dato.</p>;

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Composizione">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * c;
            const el = (
              <circle
                key={s.name}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        {centerLabel ? (
          <>
            <text
              x="50%"
              y={centerSub ? "46%" : "50%"}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground"
              style={{ fontSize: 20, fontWeight: 600 }}
            >
              {centerLabel}
            </text>
            {centerSub ? (
              <text
                x="50%"
                y="60%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 10 }}
              >
                {centerSub}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>

      <ul className="min-w-[180px] flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-start gap-2">
            <span
              className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="flex-1 leading-tight">
              {s.name}
              {s.hint ? <span className="block text-xs text-muted-foreground">{s.hint}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">
              {s.value}
              <span className="ml-1 text-xs text-muted-foreground">
                {Math.round((s.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
