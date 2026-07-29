import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adviseDailyCap } from "@/lib/outreach-send-cap";
import { ReachCapForm } from "@/app/admin/settings/reach-cap-form";

const TONE: Record<string, string> = {
  raise: "border-green-500/40 bg-green-500/5",
  lower: "border-destructive/40 bg-destructive/5",
  hold: "border-border bg-muted/40",
  unused: "border-border bg-muted/40",
};

/**
 * Il tetto agli invii automatici e il consiglio su quando alzarlo.
 * Il consiglio non è un timer: guarda quanto stai usando il tetto, quante
 * disiscrizioni raccogli e da quanto regge la soglia. Può dire anche
 * "non alzare" o "abbassa" — ed è quando serve di più.
 */
export async function ReachCapPanel({ ownerUserId }: { ownerUserId: string }) {
  const a = await adviseDailyCap(ownerUserId);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">Invii automatici: tetto giornaliero</CardTitle>
        <CardDescription>
          Vale solo per i follow-up che partono da soli. La prima mail resta tua, e non è
          soggetta al tetto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Tetto attuale</p>
            <p className="text-2xl font-semibold tabular-nums">{a.currentCap}<span className="text-sm font-normal text-muted-foreground">/giorno</span></p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Oggi</p>
            <p className="text-2xl font-semibold tabular-nums">{a.sentToday}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Media 7 giorni</p>
            <p className="text-2xl font-semibold tabular-nums">{a.avgDaily}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disiscrizioni 7gg</p>
            <p className="text-2xl font-semibold tabular-nums">
              {a.optOutsLast7}
              {a.sentLast7 > 0 ? (
                <span className="text-sm font-normal text-muted-foreground"> · {a.optOutRate}%</span>
              ) : null}
            </p>
          </div>
        </div>

        <div className={`rounded-md border p-3 text-sm ${TONE[a.action] ?? TONE.hold}`}>
          <p>{a.message}</p>
        </div>

        <ReachCapForm currentCap={a.currentCap} suggestedCap={a.suggestedCap} action={a.action} />
      </CardContent>
    </Card>
  );
}
