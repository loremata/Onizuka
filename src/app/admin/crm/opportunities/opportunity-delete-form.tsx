"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteOpportunity, type OpportunityActionResult } from "./actions";

function DelBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? "Eliminazione…" : "Elimina opportunità"}
    </Button>
  );
}

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
      <DelBtn />
    </form>
  );
}
