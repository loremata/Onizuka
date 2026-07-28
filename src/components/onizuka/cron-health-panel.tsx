import Link from "next/link";
import { dateTimeFormatIt } from "@/lib/datetime-it";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadCronHealth, cronProblemLine, type CronHealthStatus } from "@/lib/cron-health";

const BADGE: Record<CronHealthStatus, { label: string; className: string }> = {
  ok: { label: "ok", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  silent: { label: "fermo", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  failing: { label: "errore", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  stuck: { label: "appeso", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  never: { label: "mai girato", className: "bg-muted text-muted-foreground" },
};

/**
 * Salute dei lavori notturni. Risponde alla domanda che prima non aveva
 * risposta: "gira ancora tutto?". Mostra anche la versione in produzione,
 * perché il 28/07 i deploy fallivano e il sito serviva il codice del giorno
 * prima senza che nulla lo dicesse.
 */
export async function CronHealthPanel() {
  const health = await loadCronHealth();
  const fmt = dateTimeFormatIt({ dateStyle: "short", timeStyle: "short" });

  return (
    <Card className={`max-w-3xl ${health.healthy ? "" : "border-destructive/40"}`}>
      <CardHeader>
        <CardTitle className="text-base">Salute lavori notturni</CardTitle>
        <CardDescription>
          {health.healthy
            ? "Tutti i lavori programmati hanno completato un giro nella finestra attesa."
            : `${health.problems.length} lavoro/i richiede attenzione. La sveglia avvisa su Telegram al massimo una volta ogni 12 ore per lavoro.`}
          {health.deployment.shortSha ? (
            <>
              {" "}
              In produzione:{" "}
              <span className="font-mono text-xs">{health.deployment.shortSha}</span>
              {health.deployment.message ? ` — ${health.deployment.message}` : ""}
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {health.problems.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {health.problems.map((p) => (
              <li key={p.name}>{cronProblemLine(p)}</li>
            ))}
          </ul>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Lavoro</th>
                <th className="py-2 font-medium">Atteso</th>
                <th className="py-2 font-medium">Ultimo giro ok</th>
                <th className="py-2 text-right font-medium">Durata</th>
                <th className="py-2 text-right font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {health.rows.map((r) => (
                <tr key={r.name} className="border-b border-border/50">
                  <td className="py-2">{r.label}</td>
                  <td className="py-2 text-xs text-muted-foreground">{r.schedule}</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {r.lastOkAt ? fmt.format(r.lastOkAt) : "—"}
                  </td>
                  <td className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {r.lastDurationMs != null ? `${(r.lastDurationMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${BADGE[r.status].className}`}>
                      {BADGE[r.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Un lavoro &quot;appeso&quot; è un giro iniziato e mai chiuso: quasi sempre il timeout
          della funzione, che per sua natura non riesce a segnalarsi da solo. Resta scoperto
          il caso in cui Vercel non esegue più alcun cron: per quello serve un controllo
          esterno su{" "}
          <Link href="/api/health/ready" className="underline">
            /api/health/ready
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
