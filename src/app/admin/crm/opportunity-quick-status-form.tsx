"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { OpportunityStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { opportunityStatusLabel, opportunityStatusOptions } from "@/lib/crm-opportunity";
import { updateOpportunityStatus, type OpportunityActionResult } from "./opportunities/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0 px-2 text-xs" disabled={pending}>
      {pending ? "…" : "Sposta"}
    </Button>
  );
}

/** Dopo invio riuscito, forza il refresh della route server (colonne pipeline / tabella). */
function RefreshAfterSubmit() {
  const { pending } = useFormStatus();
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      router.refresh();
    }
    wasPending.current = pending;
  }, [pending, router]);

  return null;
}

const initialState: OpportunityActionResult = null;

type Layout = "pipeline" | "table";

export function OpportunityQuickStatusForm({
  opportunityId,
  current,
  layout = "pipeline",
}: {
  opportunityId: string;
  current: OpportunityStatus;
  layout?: Layout;
}) {
  const bound = (prev: OpportunityActionResult, formData: FormData) =>
    updateOpportunityStatus(opportunityId, prev, formData);

  const [state, formAction] = useFormState(bound, initialState);

  const shell =
    layout === "pipeline"
      ? "mt-2 flex flex-col gap-1 border-t border-border/40 pt-2"
      : "flex min-w-[200px] flex-col gap-1";

  return (
    <form action={formAction} className={shell}>
      <RefreshAfterSubmit />
      {state && "error" in state && <span className="text-xs text-destructive">{state.error}</span>}
      {state && "ok" in state && state.ok && (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          Stato aggiornato.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <label
          htmlFor={`opp-status-${opportunityId}`}
          className="text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          Stato
        </label>
        <select
          id={`opp-status-${opportunityId}`}
          name="status"
          defaultValue={current}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          {opportunityStatusOptions.map((s) => (
            <option key={s} value={s}>
              {opportunityStatusLabel[s]}
            </option>
          ))}
        </select>
        <SubmitButton />
      </div>
    </form>
  );
}
