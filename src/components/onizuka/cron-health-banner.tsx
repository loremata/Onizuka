import Link from "next/link";
import { loadCronHealth, cronProblemLine } from "@/lib/cron-health";

/**
 * Avviso in home: compare SOLO quando un lavoro notturno non gira.
 * Se va tutto bene non occupa spazio — un pannello sempre verde smette di
 * essere letto dopo due giorni.
 */
export async function CronHealthBanner() {
  const health = await loadCronHealth().catch(() => null);
  if (!health || health.healthy) return null;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium">
        {health.problems.length === 1
          ? "Un lavoro notturno non sta girando"
          : `${health.problems.length} lavori notturni non stanno girando`}
      </p>
      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        {health.problems.slice(0, 3).map((p) => (
          <li key={p.name}>{cronProblemLine(p)}</li>
        ))}
      </ul>
      <Link href="/admin/settings" className="mt-2 inline-block text-sm text-primary hover:underline">
        Dettaglio in Impostazioni →
      </Link>
    </div>
  );
}
