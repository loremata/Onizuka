"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLine, replaceTiers } from "../actions";

interface Line {
  id: string;
  key: string;
  label: string;
  unit: string;
  hasTiers: boolean;
  target: number | null;
  status: string;
  statusNote: string | null;
  rules: string | null;
  tiers: { minQty: number; value: number }[];
}

const STATI = ["ATTIVA", "IN_ABILITAZIONE", "NON_ABILITATA", "BLOCCATA"];

export function LineEditor({ line }: { line: Line }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState(
    line.tiers.map((t) => ({ minQty: String(t.minQty), value: String(t.value).replace(".", ",") })),
  );
  const [target, setTarget] = useState(line.target == null ? "" : String(line.target));
  const [status, setStatus] = useState(line.status);
  const [statusNote, setStatusNote] = useState(line.statusNote ?? "");
  const [rules, setRules] = useState(line.rules ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isMult = line.unit === "MULTIPLIER_ON_FEE";

  async function save() {
    setSaving(true);
    setMsg(null);
    const r1 = await updateLine(line.id, { target, status, statusNote, rules });
    const r2 = await replaceTiers(line.id, tiers);
    setSaving(false);
    const err = r1?.error ?? r2?.error;
    setMsg(err ?? "Salvato ✓");
    if (!err) router.refresh();
  }

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        <span>
          <span className="font-medium">{line.label}</span>{" "}
          <span className="font-mono text-xs text-muted-foreground">{line.key}</span>
          {status !== "ATTIVA" ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {status.toLowerCase().replace("_", " ")}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {line.hasTiers ? `${line.tiers.length} scaglioni` : `${line.tiers[0]?.value ?? 0} €/pz`} {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t px-4 py-4">
          {/* scaglioni */}
          <div>
            <div className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
              <span>Da pezzi/mese</span>
              <span>{isMult ? "Moltiplicatore sul canone" : "€ per pezzo"}</span>
              <span />
            </div>
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={t.minQty}
                    onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)))}
                    inputMode="numeric"
                    className="rounded border bg-background px-2 py-1 text-sm tabular-nums"
                  />
                  <input
                    value={t.value}
                    onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                    inputMode="decimal"
                    className="rounded border bg-background px-2 py-1 text-sm tabular-nums"
                  />
                  <button
                    onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                    className="rounded px-2 text-xs text-muted-foreground hover:text-red-600"
                    aria-label="Rimuovi scaglione"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {line.hasTiers ? (
              <button
                onClick={() => {
                  const last = tiers[tiers.length - 1];
                  setTiers([...tiers, { minQty: String((Number(last?.minQty) || 0) + 10), value: last?.value ?? "0" }]);
                }}
                className="mt-2 rounded border border-dashed px-3 py-1 text-xs text-muted-foreground hover:border-solid"
              >
                + scaglione
              </button>
            ) : null}
          </div>

          {/* obiettivo e stato */}
          <div className="grid gap-3 sm:grid-cols-2">
            {line.hasTiers ? (
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Obiettivo personale (pezzi)</span>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  inputMode="numeric"
                  placeholder="—"
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                />
              </label>
            ) : null}
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Abilitazione</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1 text-sm"
              >
                {STATI.map((s) => (
                  <option key={s} value={s}>
                    {s.toLowerCase().replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {status !== "ATTIVA" ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Perché non è attiva</span>
              <input
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="es. dispositivi in spedizione"
                className="w-full rounded border bg-background px-2 py-1 text-sm"
              />
            </label>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Cosa conta e cosa no (mostrato accanto al numero)
            </span>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={3}
              className="w-full rounded border bg-background px-2 py-1 text-sm"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Salvo…" : "Salva pista"}
            </button>
            {msg ? (
              <span className={"text-xs " + (msg.includes("✓") ? "text-green-600" : "text-red-600")}>{msg}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
