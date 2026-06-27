import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Snapshot "colpo d'occhio" delle utenze retail (stile Customer Scoring): 6 caselle. */
const SLOTS = [
  { key: "MOBILE", label: "Telefonia Mobile", icon: "📱" },
  { key: "FIBER", label: "Fibra / Fisso", icon: "🌐" },
  { key: "ENERGY", label: "Luce", icon: "💡" },
  { key: "GAS", label: "Gas", icon: "🔥" },
  { key: "SKY", label: "Sky", icon: "📺" },
  { key: "TELEPASS", label: "Telepass", icon: "🚗" },
] as const;

const eur2 = (n: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

function reminder(switchReminderAt: Date | null): { due: boolean; text: string } | null {
  if (!switchReminderAt) return null;
  const days = Math.ceil((switchReminderAt.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { due: true, text: "🔔 Cambio compagnia proponibile ORA" };
  return { due: false, text: `cambio tra ~${Math.round(days / 30)} mesi` };
}

export async function ClientRetailSnapshotCard({ clientId }: { clientId: string }) {
  const contracts = await prisma.clientRetailContract.findMany({
    where: { clientId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const byKind = new Map<string, typeof contracts>();
  for (const c of contracts) {
    const arr = byKind.get(c.kind) ?? [];
    arr.push(c);
    byKind.set(c.kind, arr);
  }
  const total = contracts.reduce((s, c) => s + Number(c.monthlyEur.toString()), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telefonia & Utenze — colpo d&apos;occhio</CardTitle>
        <CardDescription>
          Stato · operatore · reminder cambio compagnia
          {total > 0 ? (
            <>
              {" "}· Spesa gestita: <strong>{eur2(total)}/mese</strong>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SLOTS.map((slot) => {
            const items = byKind.get(slot.key) ?? [];
            const has = items.length > 0;
            return (
              <div
                key={slot.key}
                className={`rounded-lg border p-2.5 text-sm ${has ? "border-success/40 bg-success/5" : "border-dashed border-border bg-muted/30"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span>{slot.icon}</span>
                    {slot.label}
                  </span>
                  <span className={`text-xs ${has ? "text-success" : "text-muted-foreground"}`}>
                    {has ? "attivo con te" : "non attivo"}
                  </span>
                </div>
                {items.map((c) => {
                  const rem = reminder(c.switchReminderAt);
                  return (
                    <div key={c.id} className="mt-1.5 border-t border-success/20 pt-1.5 text-xs first:border-0 first:pt-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{c.operator ?? c.label}</span>
                        <span className="text-muted-foreground">{eur2(Number(c.monthlyEur.toString()))}/m</span>
                      </div>
                      {c.offerName || c.paymentMethod ? (
                        <div className="text-muted-foreground">
                          {c.offerName ?? ""}
                          {c.paymentMethod ? `${c.offerName ? " · " : ""}${c.paymentMethod}` : ""}
                        </div>
                      ) : null}
                      {rem ? (
                        <div className={rem.due ? "font-semibold text-destructive" : "text-muted-foreground"}>{rem.text}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
