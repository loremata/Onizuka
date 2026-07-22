import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/onizuka/admin-page-header";
import { InserimentiNav } from "../../module-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineEditor } from "./line-editor";
import { GateEditor } from "./gate-editor";
import { StatoPiano } from "./stato-piano";

export default async function PianoDetailPage({ params }: { params: { id: string } }) {
  const session = await requireFullAdmin();

  const plan = await prisma.incentivePlan.findFirst({
    where: { id: params.id, ownerUserId: session.user.id },
    include: {
      lines: { include: { tiers: { orderBy: { minQty: "asc" } } }, orderBy: { sortOrder: "asc" } },
      prizes: { include: { gates: true, scoreKpis: { orderBy: { sortOrder: "asc" } }, bonuses: true, halvings: true } },
      params: true,
    },
  });
  if (!plan) notFound();

  const isLinear = plan.engineVersion === "linear";

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`${plan.brand} — ${plan.month}`}
        lead={plan.label}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/inserimenti/piano?mese=${plan.month}`}>← Piani</Link>
          </Button>
        }
      />

      <InserimentiNav />

      <StatoPiano planId={plan.id} status={plan.status} notes={plan.notes} />

      {isLinear ? (
        <Card className="border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="py-4">
            <CardDescription>
              Piano a compenso lineare: ogni pista ha un solo valore, il € per pezzo. Non ci sono soglie né gare.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Piste</CardTitle>
          <CardDescription>
            {isLinear
              ? "Il valore dello scaglione 0 è il € per pezzo."
              : "Soglia = pezzi minimi nel mese. Valore = moltiplicatore sul canone (MNP/AL/Fisso) o € per pezzo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {plan.lines.map((l) => (
            <LineEditor
              key={l.id}
              line={{
                id: l.id,
                key: l.key,
                label: l.label,
                unit: l.unit,
                hasTiers: l.hasTiers,
                target: l.target,
                status: l.status,
                statusNote: l.statusNote,
                rules: l.rules,
                tiers: l.tiers.map((t) => ({ minQty: t.minQty, value: Number(t.value) })),
              }}
            />
          ))}
        </CardContent>
      </Card>

      {plan.prizes.map((pr) => (
        <Card key={pr.id}>
          <CardHeader>
            <CardTitle>{pr.label}</CardTitle>
            <CardDescription>
              Premio da {Number(pr.minPrize).toLocaleString("it-IT")} € a {Number(pr.maxPrize).toLocaleString("it-IT")} €
              · punteggio {Number(pr.minPoints)} → {Number(pr.maxPoints)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pr.gates.length ? (
              <div>
                <h4 className="mb-2 text-sm font-medium">
                  Cancelli d&apos;accesso <span className="text-muted-foreground">(sono in AND: mancarne uno azzera il premio)</span>
                </h4>
                <div className="space-y-2">
                  {pr.gates.map((g) => (
                    <GateEditor key={g.id} gate={{ id: g.id, lineKey: g.lineKey, minQty: g.minQty }} />
                  ))}
                </div>
              </div>
            ) : null}

            {pr.bonuses.length ? (
              <div className="text-sm">
                <h4 className="mb-1 font-medium">Bonus</h4>
                {pr.bonuses.map((b) => (
                  <p key={b.id} className="text-muted-foreground">
                    {b.label ?? `${b.conditionLineKey} ≥ ${b.conditionMinQty}`} → +{(Number(b.pct) * 100).toFixed(0)}%
                  </p>
                ))}
              </div>
            ) : null}

            {pr.halvings.length ? (
              <div className="text-sm">
                <h4 className="mb-1 font-medium">Dimezzamenti</h4>
                {pr.halvings.map((h) => (
                  <p key={h.id} className="text-muted-foreground">
                    {h.label ?? `${h.inputKey} < ${Number(h.minValue)}`} → premio ×{Number(h.factor)}
                  </p>
                ))}
              </div>
            ) : null}

            {pr.scoreKpis.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">
                  Punteggi ({pr.scoreKpis.length} voci)
                </summary>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {pr.scoreKpis.map((k) => (
                      <tr key={k.id} className="border-b last:border-0">
                        <td className="py-1 pr-3">{k.label}</td>
                        <td className="py-1 pr-3 text-muted-foreground">
                          {k.source === "MANUAL" ? "da consuntivo" : "dalle vendite"}
                        </td>
                        <td className="py-1 text-right tabular-nums">{Number(k.points)} pt</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {plan.params.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Regole strutturali</CardTitle>
            <CardDescription>
              Bill size, penalità incrociate ed extra. Cambiano di rado: si modificano dal codice del motore, versionate
              per <code className="text-xs">engineVersion</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              {plan.params.map((p) => (
                <div key={p.id}>
                  <span className="font-mono font-medium">{p.key}</span>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2">{JSON.stringify(p.valueJson, null, 2)}</pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
