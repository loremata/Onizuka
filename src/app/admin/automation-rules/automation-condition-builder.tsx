"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const PRESETS: { label: string; key: string; op: string; value: string }[] = [
  { label: "Post Instagram", key: "platform", op: "EQ", value: "INSTAGRAM" },
  { label: "Entrata > 1000€", key: "amountEur", op: "GT", value: "1000" },
  { label: "Lead referral", key: "source", op: "EQ", value: "REFERRAL" },
  { label: "Ticket alta priorità", key: "priority", op: "EQ", value: "HIGH" },
];

/** Helper visuale per compilare condizione if/then (non sostituisce il form). */
export function AutomationConditionBuilder() {
  const [key, setKey] = useState("");
  const [op, setOp] = useState("EQ");
  const [value, setValue] = useState("");

  function applyPreset(p: (typeof PRESETS)[0]) {
    setKey(p.key);
    setOp(p.op);
    setValue(p.value);
    const keyEl = document.getElementById("conditionKey") as HTMLInputElement | null;
    const opEl = document.getElementById("conditionOperator") as HTMLSelectElement | null;
    const valEl = document.getElementById("conditionValue") as HTMLInputElement | null;
    if (keyEl) keyEl.value = p.key;
    if (opEl) opEl.value = p.op;
    if (valEl) valEl.value = p.value;
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Builder condizione (quick preset)</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-muted"
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Key</Label>
          <Input className="h-8 text-xs" value={key} onChange={(e) => setKey(e.target.value)} readOnly />
        </div>
        <div>
          <Label className="text-xs">Op</Label>
          <Input className="h-8 text-xs" value={op} readOnly />
        </div>
        <div>
          <Label className="text-xs">Value</Label>
          <Input className="h-8 text-xs" value={value} readOnly />
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">I preset aggiornano i campi condizione del form sotto.</p>
    </div>
  );
}
