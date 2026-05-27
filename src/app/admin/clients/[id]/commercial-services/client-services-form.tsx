"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncClientCommercialServices, type ClientServiceActionResult } from "./actions";

type ServiceRow = {
  slug: string;
  name: string;
  category: string;
  brandName: string | null;
  active: boolean;
  notes: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvataggio…" : "Salva servizi"}
    </Button>
  );
}

export function ClientServicesForm({ clientId, services }: { clientId: string; services: ServiceRow[] }) {
  const bound = syncClientCommercialServices.bind(null, clientId);
  const [state, action] = useFormState(bound, null as ClientServiceActionResult);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <ul className="divide-y divide-border/60 rounded-md border border-border/60">
        {services.map((s) => (
          <li key={s.slug} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
            <label className="flex min-w-[200px] items-center gap-2 text-sm">
              <input type="checkbox" name={`active_${s.slug}`} defaultChecked={s.active} className="rounded" />
              <span className="font-medium">{s.name}</span>
            </label>
            <span className="text-xs text-muted-foreground">
              {s.category}
              {s.brandName ? ` · ${s.brandName}` : ""}
            </span>
            <Input
              name={`notes_${s.slug}`}
              defaultValue={s.notes}
              placeholder="Note"
              className="max-w-md text-xs"
            />
          </li>
        ))}
      </ul>
      <SubmitButton />
    </form>
  );
}
