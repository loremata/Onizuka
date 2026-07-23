"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveMonthlyInputs } from "../piano/actions";

interface Kpi {
  key: string;
  label: string;
  points: number;
  prize: string;
}
interface Halving {
  key: string;
  label: string;
  minValue: number;
  prize: string;
}

export function InputMensili({
  month,
  kpis,
  halvings,
  initial,
}: {
  month: string;
  kpis: Kpi[];
  halvings: Halving[];
  initial: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: string, v: string) => setValues({ ...values, [k]: v });
  const n = (k: string) => {
    const x = parseFloat((values[k] ?? "").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };

  // punteggio in tempo reale: è il motivo per cui questa pagina esiste
  const punteggio = kpis.reduce((s, k) => s + n(k.key) * k.points, 0);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await saveMonthlyInputs(month, values);
    setSaving(false);
    setMsg(res?.error ?? "Salvato ✓");
    if (!res?.error) router.refresh();
  }

  return (
    <div className="space-y-6">
      {halvings.length ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Soglie che dimezzano il premio</CardTitle>
            <CardDescription>Sotto questi valori il premio viene riconosciuto a metà.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {halvings.map((h) => {
              const v = n(h.key);
              const ok = v >= h.minValue;
              return (
                <div key={h.key} className="flex flex-wrap items-center gap-3">
                  <input
                    value={values[h.key] ?? ""}
                    onChange={(e) => set(h.key, e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className="w-24 rounded border bg-background px-2 py-1 text-sm tabular-nums"
                  />
                  <span className="text-sm">{h.label}</span>
                  <span className={"text-xs " + (ok ? "text-green-600" : "text-amber-600")}>
                    {ok ? `✓ soglia ${h.minValue} raggiunta` : `serve ≥ ${h.minValue} — altrimenti premio al 50%`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {kpis.length ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <CardTitle className="text-base">KPI a punteggio</CardTitle>
                <CardDescription>Conteggi dal consuntivo TIM. Il punteggio si aggiorna mentre scrivi.</CardDescription>
              </div>
              <span className="text-sm">
                Punteggio: <strong className="text-lg tabular-nums">{punteggio}</strong>
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">KPI</th>
                    <th className="py-2 pr-4 text-right">Punti/cad</th>
                    <th className="py-2 pr-4 text-right">Conteggio</th>
                    <th className="py-2 text-right">Totale punti</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k) => (
                    <tr key={k.key} className="border-b last:border-0">
                      <td className="py-2 pr-4">{k.label}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{k.points}</td>
                      <td className="py-2 pr-4 text-right">
                        <input
                          value={values[k.key] ?? ""}
                          onChange={(e) => set(k.key, e.target.value)}
                          inputMode="numeric"
                          placeholder="0"
                          className="w-20 rounded border bg-background px-2 py-1 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {n(k.key) * k.points || <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvo…" : "Salva input del mese"}
        </Button>
        {msg ? <span className={"text-sm " + (msg.includes("✓") ? "text-green-600" : "text-red-600")}>{msg}</span> : null}
      </div>
    </div>
  );
}
