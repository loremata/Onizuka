"use client";

import { useFormState } from "react-dom";
import { ConfirmSubmitButton } from "@/components/onizuka/confirm-submit-button";
import { deleteLead, type LeadActionResult } from "./actions";

const initial: LeadActionResult = null;

export function LeadDeleteForm({ leadId }: { leadId: string }) {
  const [state, formAction] = useFormState(deleteLead, initial);
  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-4">
      <input type="hidden" name="id" value={leadId} />
      {state && "error" in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <ConfirmSubmitButton label="Elimina lead" question="Eliminare questo lead?" />
    </form>
  );
}
