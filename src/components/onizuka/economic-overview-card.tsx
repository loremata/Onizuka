import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadEconomicOverview, eurLabel } from "@/lib/economic-overview";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground",
};

/**
 * Il punto della situazione economica: reale vs stimato, agenzia + negozio,
 * con i consigli operativi. Server component: si monta dove serve (home,
 * Finance) e carica da solo i suoi dati.
 */
export async function EconomicOverviewCard({ ownerUserId }: { ownerUserId: string }) {
  const o = await loadEconomicOverview(ownerUserId);
  if (!o) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Punto della situazione · {o.month}</CardTitle>
        <CardDescription>
          Reale = incassato − spese pagate + maturato negozio. Stimato = chiusura mese al
          ritmo attuale. Importi netto IVA e netto spese.
          {o.negozio?.provisional ? " ~ piano negozio provvisorio." : ""}
          {!o.negozio ? " Cruscotto negozio non disponibile: totali solo agenzia." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Reale (oggi)</p>
            <p className="text-2xl font-semibold tabular-nums">€ {eurLabel(o.realeEur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stimato fine mese</p>
            <p className="text-2xl font-semibold tabular-nums">€ {eurLabel(o.stimatoEur)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              <Link href="/admin/inserimenti" className="hover:underline">
                Negozio
              </Link>{" "}
              maturato
            </p>
            {o.negozio ? (
              <p className="text-lg font-medium tabular-nums">
                € {eurLabel(o.negozio.maturatoEur)}
                {o.negozio.proiezioneEur != null ? (
                  <span className="text-sm text-muted-foreground">
                    {" "}
                    → € {eurLabel(o.negozio.proiezioneEur)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="text-lg font-medium text-muted-foreground">n/d</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              <Link href="/admin/finance" className="hover:underline">
                Agenzia
              </Link>{" "}
              incassato / atteso
            </p>
            <p className="text-lg font-medium tabular-nums">
              € {eurLabel(o.agenzia.incassatoEur)}
              <span className="text-sm text-muted-foreground"> / € {eurLabel(o.agenzia.attesoEur)}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          MRR € {eurLabel(o.agenzia.mrrEur)} · pipeline pesata € {o.agenzia.pipelinePesataLabel}
          {o.negozio ? ` · negozio mese scorso € ${eurLabel(o.negozio.mesePrecedenteEur)}` : ""}
          {o.agenzia.overdueCount > 0 ? (
            <span className="text-red-600 dark:text-red-400"> · {o.agenzia.overdueCount} scadute</span>
          ) : null}
        </p>

        {o.consigli.length > 0 ? (
          <ul className="space-y-1.5 border-t border-border/60 pt-3 text-sm">
            {o.consigli.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${PRIORITY_DOT[c.priority]}`} />
                <Link href={c.href} className="hover:underline">
                  {c.text}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
