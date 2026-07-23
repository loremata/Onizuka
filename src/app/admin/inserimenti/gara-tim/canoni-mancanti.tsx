"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSaleFee } from "../actions";

export interface SaleSenzaCanone {
  id: string;
  date: string; // "YYYY-MM-DD"
  brand: string;
  lineLabel: string;
  domiciled: boolean;
  notes: string | null;
}

/**
 * Lista delle vendite a moltiplicatore registrate SENZA canone: finché il canone
 * manca, per la gara valgono 0 €. Qui si completano una per una col valore vero
 * (decisione Lorenzo: mai canoni inventati in automatico).
 */
export function CanoniMancanti({ sales }: { sales: SaleSenzaCanone[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(id: string) {
    const v = (values[id] ?? "").trim();
    if (!v) {
      setErrors((e) => ({ ...e, [id]: "Scrivi il canone." }));
      return;
    }
    setBusy(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    const res = await setSaleFee(id, v);
    setBusy(null);
    if (res?.error) {
      setErrors((e) => ({ ...e, [id]: res.error }));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {sales.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="tabular-nums text-muted-foreground">{s.date.slice(8, 10)}/{s.date.slice(5, 7)}</span>
          <span className="font-medium">{s.lineLabel}</span>
          {s.domiciled ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs">domiciliata</span> : null}
          {s.notes ? <span className="truncate text-xs text-muted-foreground max-w-[16rem]">{s.notes}</span> : null}
          <span className="ml-auto flex items-center gap-2">
            <input
              inputMode="decimal"
              placeholder="es. 9,99"
              value={values[s.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [s.id]: e.target.value }))}
              className="w-24 rounded-md border bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => save(s.id)}
              disabled={busy === s.id}
              className="rounded-md border px-2.5 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {busy === s.id ? "…" : "Salva"}
            </button>
          </span>
          {errors[s.id] ? <span className="w-full text-xs text-red-600">{errors[s.id]}</span> : null}
        </div>
      ))}
    </div>
  );
}
