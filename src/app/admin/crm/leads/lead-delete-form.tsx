"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteLead, type LeadActionResult } from "./actions";

function DelBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {pending ? "Eliminazione…" : "Elimina lead"}
    </Button>
  );
}

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
      <DelBtn />
    </form>
  );
}
