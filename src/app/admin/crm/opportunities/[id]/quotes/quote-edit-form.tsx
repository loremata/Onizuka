"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QuoteLine } from "@/lib/quote-lines";
import { updateOpportunityQuote } from "./actions";
import { QuoteLinesEditor } from "./quote-lines-editor";

export function QuoteEditForm({
  opportunityId,
  quoteId,
  title,
  notes,
  taxPercent,
  validUntilIso,
  defaultLines,
}: {
  opportunityId: string;
  quoteId: string;
  title: string;
  notes: string | null;
  taxPercent: number;
  validUntilIso: string | null;
  defaultLines: QuoteLine[];
}) {
  const bound = updateOpportunityQuote.bind(null, opportunityId, quoteId);
  const [state, action, pending] = useFormState(bound, null);
  const validUntilValue = validUntilIso ? validUntilIso.slice(0, 10) : "";

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Titolo
        </label>
        <Input id="title" name="title" defaultValue={title} disabled={pending} />
      </div>
      <div className="space-y-1">
        <label htmlFor="validUntil" className="text-sm font-medium">
          Valido fino al (opz.)
        </label>
        <Input id="validUntil" name="validUntil" type="date" defaultValue={validUntilValue} disabled={pending} />
      </div>
      <QuoteLinesEditor name="linesJson" defaultLines={defaultLines} taxPercentDefault={taxPercent} />
      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Note
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={notes ?? ""}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Salvataggio…" : "Salva modifiche"}
      </Button>
    </form>
  );
}
