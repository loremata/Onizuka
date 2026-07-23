"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGate } from "../actions";

export function GateEditor({ gate }: { gate: { id: string; lineKey: string; minQty: number } }) {
  const router = useRouter();
  const [v, setV] = useState(String(gate.minQty));
  const [saving, setSaving] = useState(false);
  const dirty = v !== String(gate.minQty);

  async function save() {
    setSaving(true);
    await updateGate(gate.id, v);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-40 font-mono text-xs">{gate.lineKey}</span>
      <span className="text-muted-foreground">≥</span>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        inputMode="numeric"
        className="w-20 rounded border bg-background px-2 py-1 text-sm tabular-nums"
      />
      <span className="text-xs text-muted-foreground">pezzi</span>
      {dirty ? (
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
        >
          {saving ? "…" : "Salva"}
        </button>
      ) : null}
    </div>
  );
}
