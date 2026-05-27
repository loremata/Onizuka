import type { DayCount } from "@/lib/client-kpi-trends";

type Props = {
  buckets: DayCount[];
  maxBarHeight?: number;
};

export function KpiTrendBars({ buckets, maxBarHeight = 56 }: Props) {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <ul className="flex items-end gap-1.5" style={{ minHeight: maxBarHeight + 20 }}>
      {buckets.map((b) => {
        const h = Math.max(2, Math.round((b.count / max) * maxBarHeight));
        return (
          <li key={b.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-[2.5rem] rounded-t bg-primary/80 transition-[height]"
              style={{ height: h }}
              title={`${b.label}: ${b.count}`}
              aria-label={`${b.label}, ${b.count}`}
            />
            <span className="max-w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
              {b.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
