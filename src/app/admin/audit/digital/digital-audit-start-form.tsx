"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startDigitalAuditByVat, type DigitalAuditActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Analisi in corso…" : "Avvia audit"}
    </Button>
  );
}

export function DigitalAuditStartForm() {
  const [state, action] = useFormState(startDigitalAuditByVat, null as DigitalAuditActionResult);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input name="vatNumber" placeholder="P.IVA (es. IT12345678901)" className="max-w-xs" />
      <Input name="website" placeholder="Sito web (opzionale, es. esempio.it)" className="max-w-md" />
      <Input name="businessName" placeholder="Ragione sociale (opzionale)" className="max-w-md" />
      <p className="text-xs text-muted-foreground">
        Almeno P.IVA oppure sito/ragione sociale. Il matching CRM evita duplicati prima dell&apos;audit.
      </p>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="createOutreach" className="rounded" />
        Crea bozza email Reach (in attesa approvazione)
      </label>
      {state && "error" in state ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
