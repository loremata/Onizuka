"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTimeEntry, type TimeEntryResult } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : "Registra"}
    </Button>
  );
}

type ClientOpt = { id: string; companyName: string };

export function TimeEntryForm({ clients }: { clients: ClientOpt[] }) {
  const [state, formAction] = useFormState(createTimeEntry, null as TimeEntryResult);
  const today = new Date().toISOString().slice(0, 16);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="description">Cosa hai fatto</Label>
        <Input id="description" name="description" required placeholder="Es. Call cliente, report mensile" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="minutes">Minuti</Label>
          <Input id="minutes" name="minutes" type="number" min={1} max={1440} defaultValue={30} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workedAt">Data/ora</Label>
          <Input id="workedAt" name="workedAt" type="datetime-local" defaultValue={today} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="hourlyRateEur">Tariffa oraria € (opzionale)</Label>
        <Input id="hourlyRateEur" name="hourlyRateEur" type="number" step="0.01" min={0} max={9999} placeholder="Es. 85" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="projectCode">Codice commessa / progetto (opzionale)</Label>
        <Input id="projectCode" name="projectCode" maxLength={64} placeholder="Es. PRJ-2026-042" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientId">Cliente (opzionale)</Label>
        <select
          id="clientId"
          name="clientId"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="">— Nessuno —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="space-y-1 text-sm">
        <legend className="text-sm font-medium">Fatturabile</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="billable" value="true" defaultChecked />
          Sì
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="billable" value="false" />
          No
        </label>
      </fieldset>
      <Submit />
    </form>
  );
}
