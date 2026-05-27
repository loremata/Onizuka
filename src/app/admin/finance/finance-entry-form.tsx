"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFinanceEntry, type FinanceActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "…" : "Aggiungi"}
    </Button>
  );
}

type ClientOption = { id: string; companyName: string };
type AssetOption = { id: string; name: string; clientId: string; platform: string | null };

export function FinanceEntryForm({
  clients = [],
  assets = [],
}: {
  clients?: ClientOption[];
  assets?: AssetOption[];
}) {
  const [state, action] = useFormState(createFinanceEntry, null as FinanceActionResult);
  const [clientId, setClientId] = useState("");

  const assetOptions = useMemo(
    () => (clientId ? assets.filter((a) => a.clientId === clientId) : []),
    [assets, clientId]
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Etichetta</label>
        <Input name="label" required className="w-48" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
        <select name="type" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="INCOME">Entrata</option>
          <option value="EXPENSE">Uscita</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Importo €</label>
        <Input name="amountEur" type="number" step="0.01" min="0" required className="w-28" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Cliente</label>
        <select
          name="clientId"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="h-10 w-44 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Asset / canale</label>
        <select
          name="assetId"
          className="h-10 w-44 rounded-md border border-input bg-background px-3 text-sm"
          disabled={!clientId}
        >
          <option value="">—</option>
          {assetOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.platform ? ` (${a.platform})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Scadenza</label>
        <Input name="dueDate" type="date" className="w-40" />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="recurringMonthly" />
        Conta nel <strong className="font-medium">MRR</strong> mensile (solo tipo Entrata)
      </label>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Prossimo rinnovo (se MRR)</label>
        <Input name="renewalDate" type="date" className="w-40" />
      </div>
      {state?.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
