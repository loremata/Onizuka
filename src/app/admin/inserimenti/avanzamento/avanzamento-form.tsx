"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { saveOfficialProgress } from "./actions";

export type FormLine = {
  key: string;
  label: string;
  /** Chiedere anche "di cui domiciliate"? */
  domiciled: boolean;
};

export type FormValues = Record<string, { qty: string; domiciledQty: string; breakdown: string }>;

const empty = { qty: "", domiciledQty: "", breakdown: "" };

/**
 * Il modulo con cui si trascrive l'avanzamento che TIM comunica: una data e una
 * riga per pista. Parte già compilato con l'ultimo avanzamento caricato, così
 * di solito basta cambiare la data e ritoccare i numeri cambiati.
 */
export function AvanzamentoForm({
  month,
  defaultDate,
  lines,
  initial,
  loadedFrom,
}: {
  month: string;
  defaultDate: string;
  lines: FormLine[];
  initial: FormValues;
  /** Data dei valori precompilati, se ce n'erano. */
  loadedFrom: string | null;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [values, setValues] = useState<FormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // il calendario si limita al mese che stai guardando: un avanzamento di
  // agosto dentro luglio non vuol dire niente (e il server lo rifiuterebbe)
  const [yy, mm] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();

  const row = (key: string) => values[key] ?? empty;
  const set = (key: string, patch: Partial<typeof empty>) =>
    setValues({ ...values, [key]: { ...row(key), ...patch } });

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await saveOfficialProgress({
      month,
      asOfDate: date,
      rows: lines.map((l) => ({
        lineKey: l.key,
        qty: row(l.key).qty,
        domiciledQty: l.domiciled ? row(l.key).domiciledQty : "",
        breakdown: row(l.key).breakdown,
      })),
    });
    setSaving(false);
    if ("error" in res) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    setMsg({ ok: true, text: `Avanzamento salvato: ${res.saved} piste.` });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Inserisci l&apos;avanzamento comunicato da TIM</CardTitle>
        <CardDescription>
          Scrivi la data a cui l&apos;avanzamento si riferisce e, per ogni pista, il numero che TIM riconosce. Lascia
          vuota una pista che non compare nella comunicazione. Salvare due volte la stessa data corregge, non duplica.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium" htmlFor="asOfDate">
            Avanzamento al
          </label>
          <input
            id="asOfDate"
            type="date"
            value={date}
            min={`${month}-01`}
            max={`${month}-${String(lastDay).padStart(2, "0")}`}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-sm tabular-nums"
          />
          {loadedFrom && loadedFrom !== date ? (
            <span className="text-xs text-muted-foreground">
              i numeri qui sotto sono quelli del {itDate(loadedFrom)}: correggi quelli cambiati e salva sulla nuova data
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Pista</th>
                <th className="py-2 pr-4 text-right">Riconosciute</th>
                <th className="py-2 pr-4 text-right">Di cui domiciliate</th>
                <th className="py-2">Composizione dichiarata</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{l.label}</td>
                  <td className="py-2 pr-4 text-right">
                    <input
                      value={row(l.key).qty}
                      onChange={(e) => set(l.key, { qty: e.target.value })}
                      inputMode="decimal"
                      placeholder="—"
                      aria-label={`Quantità riconosciuta ${l.label}`}
                      className="w-20 rounded border bg-background px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {l.domiciled ? (
                      <input
                        value={row(l.key).domiciledQty}
                        onChange={(e) => set(l.key, { domiciledQty: e.target.value })}
                        inputMode="numeric"
                        placeholder="—"
                        aria-label={`Di cui domiciliate ${l.label}`}
                        className="w-20 rounded border bg-background px-2 py-1 text-right text-sm tabular-nums"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <input
                      value={row(l.key).breakdown}
                      onChange={(e) => set(l.key, { breakdown: e.target.value })}
                      placeholder="es. 5 FWA ric + 2 SMB Fix"
                      aria-label={`Composizione dichiarata ${l.label}`}
                      className="w-full min-w-[14rem] rounded border bg-background px-2 py-1 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Il Fisso può arrivare con i mezzi punti (una FWA ricaricabile vale 0,5): scrivilo come te lo dà TIM, anche
          &laquo;6,5&raquo;.
        </p>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvo…" : "Salva avanzamento"}
          </Button>
          {msg ? (
            <span className={"text-sm " + (msg.ok ? "text-green-600" : "text-red-600")}>{msg.text}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** "25/07/2026" da "2026-07-25" (copia locale: qui non si tocca il server). */
function itDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}
