"use client";

import { useFormState } from "react-dom";
import { ConfirmSubmitButton } from "@/components/onizuka/confirm-submit-button";
import { deleteOpportunity, type OpportunityActionResult } from "./actions";

const initial: OpportunityActionResult = null;

export function OpportunityDeleteForm({ opportunityId }: { opportunityId: string }) {
  const [state, formAction] = useFormState(deleteOpportunity, initial);
  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-4">
      <input type="hidden" name="id" value={opportunityId} />
      {state && "error" in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <ConfirmSubmitButton label="Elimina opportunità" question="Eliminare questa opportunità?" />
    </form>
  );
}
