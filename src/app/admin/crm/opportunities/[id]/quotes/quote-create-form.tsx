"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createOpportunityQuote } from "./actions";
import { QuoteLinesEditor } from "./quote-lines-editor";

export function QuoteCreateForm({
  opportunityId,
  defaultTitle,
}: {
  opportunityId: string;
  defaultTitle: string;
}) {
  const bound = createOpportunityQuote.bind(null, opportunityId);
  const [state, action, pending] = useFormState(bound, null);

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Titolo
        </label>
        <Input id="title" name="title" defaultValue={defaultTitle} disabled={pending} />
      </div>
      <div className="space-y-1">
        <label htmlFor="validUntil" className="text-sm font-medium">
          Valido fino al (opz.)
        </label>
        <Input id="validUntil" name="validUntil" type="date" disabled={pending} />
      </div>
      <QuoteLinesEditor name="linesJson" />
      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Note
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Condizioni, tempi, esclusioni…"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creazione…" : "Crea preventivo"}
      </Button>
    </form>
  );
}
