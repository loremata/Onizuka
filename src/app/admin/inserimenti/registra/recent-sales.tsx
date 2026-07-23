"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSale, updateSale } from "../actions";

interface Row {
  id: string;
  date: string;
  brand: string;
  lineKey: string;
  feeEur: number | null;
  domiciled: boolean;
  notes: string | null;
}

export function RecentSales({ sales }: { sales: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (!sales.length) return <p className="text-sm text-muted-foreground">Ancora nessuna vendita questo mese.</p>;

  async function remove(id: string) {
    setBusy(id);
    await deleteSale(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <ul className="divide-y text-sm">
      {sales.map((s) =>
        editing === s.id ? (
          <li key={s.id} className="py-2">
            <EditRow
              row={s}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
              onCancel={() => setEditing(null)}
            />
          </li>
        ) : (
          <li key={s.id} className="flex items-center gap-3 py-2">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{s.date.slice(5)}</span>
            <span className="flex-1">
              <span className="font-medium">{s.brand}</span> · {s.lineKey}
              {s.feeEur != null ? ` · ${s.feeEur.toLocaleString("it-IT")} €` : ""}
              {s.domiciled ? " · dom." : ""}
              {s.notes?.includes("(dedotto)") ? (
                <span className="ml-1 text-xs text-amber-600" title="MNP/AL dedotto per far quadrare i totali">
                  ⚠
                </span>
              ) : null}
            </span>
            <button
              onClick={() => setEditing(s.id)}
              className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              aria-label="Modifica"
            >
              ✎
            </button>
            <button
              onClick={() => remove(s.id)}
              disabled={busy === s.id}
              className="shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-red-600"
              aria-label="Elimina"
            >
              ✕
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

/** Modifica inline: i campi che si sbagliano davvero sono pista, canone e data. */
function EditRow({ row, onDone, onCancel }: { row: Row; onDone: () => void; onCancel: () => void }) {
  const [date, setDate] = useState(row.date);
  const [lineKey, setLineKey] = useState(row.lineKey);
  const [feeEur, setFeeEur] = useState(row.feeEur == null ? "" : String(row.feeEur).replace(".", ","));
  const [domiciled, setDomiciled] = useState(row.domiciled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("brand", row.brand);
    fd.set("lineKey", lineKey);
    fd.set("date", date);
    if (feeEur.trim()) fd.set("feeEur", feeEur);
    fd.set("domiciled", domiciled ? "true" : "false");
    const res = await updateSale(row.id, fd);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border bg-background px-2 py-1 text-xs"
        />
        <input
          value={lineKey}
          onChange={(e) => setLineKey(e.target.value)}
          placeholder="pista"
          className="w-28 rounded border bg-background px-2 py-1 text-xs"
        />
        <input
          value={feeEur}
          onChange={(e) => setFeeEur(e.target.value)}
          placeholder="canone"
          inputMode="decimal"
          className="w-20 rounded border bg-background px-2 py-1 text-xs"
        />
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={domiciled} onChange={(e) => setDomiciled(e.target.checked)} />
          dom.
        </label>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvo…" : "Salva"}
        </button>
        <button onClick={onCancel} className="rounded border px-3 py-1 text-xs">
          Annulla
        </button>
      </div>
    </div>
  );
}
