"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { LeadStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { leadStatusLabel, leadStatusOptions } from "@/lib/crm-lead-status";
import { updateLeadStatus, type LeadActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0 px-2 text-xs" disabled={pending}>
      {pending ? "…" : "Sposta"}
    </Button>
  );
}

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

const initialState: LeadActionResult = null;

export function LeadQuickStatusForm({ leadId, current }: { leadId: string; current: LeadStatus }) {
  const bound = (prev: LeadActionResult, formData: FormData) => updateLeadStatus(leadId, prev, formData);

  const [state, formAction] = useFormState(bound, initialState);

  return (
    <form action={formAction} className="flex min-w-[200px] flex-col gap-1">
      <RefreshAfterSubmit />
      {state && "error" in state && <span className="text-xs text-destructive">{state.error}</span>}
      {state && "ok" in state && state.ok && (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          Stato aggiornato.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <label
          htmlFor={`lead-status-${leadId}`}
          className="text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          Stato
        </label>
        <select
          id={`lead-status-${leadId}`}
          name="status"
          defaultValue={current}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          {leadStatusOptions.map((s) => (
            <option key={s} value={s}>
              {leadStatusLabel[s]}
            </option>
          ))}
        </select>
        <SubmitButton />
      </div>
    </form>
  );
}
